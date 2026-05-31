# Performance Optimizations

JavaScript performance improvements for large bookmark files (5000+ items).

Each task is self-contained and verifiable. Complete in order -- later tasks build on earlier ones.

---

## Phase 1: Stop destroying and recreating the tree list

**Goal:** The `list()` call should persist across reactive updates. Currently `renderMode()` tears down and recreates the entire list on every signal change.

### Task 1.1: Extract mode tracking into a computed signal ✅ DONE

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Replace the `effect(() => renderMode())` pattern with a mode-gated effect. Only call `stopList()` + recreate when the mode actually changes.
- **How:** Added `getCurrentMode()` helper and `currentMode` variable. Effect compares `nextMode !== currentMode` before tearing down. When mode is stable, the `list()` internal effect handles item-level updates.
- **Fix:** Initially the empty-state check was DOM-based (`firstElementChild`) which conflicted with the list's DOM. Switched to signal-based emptiness check (`getVisibleNodeEntries().length === 0`) so the empty-state effect reads the same signals as the list effect and reacts correctly when data arrives.
- **Verify:** `npm run typecheck && npm run build` -- both pass

### Task 1.2: Keep meta text update outside the list recreation ✅ DONE

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Split the single effect into three: `stopListEffect` (mode-gated list), `stopEmptyStateEffect` (empty message), and `stopMetaEffect` (meta text).
- **How:** Each effect reads only the signals it needs. Meta text effect reads its own signals independently. No longer bundled with list recreation.
- **Also removed:** `dnd.syncDropTargetClasses()` from the effect -- it was called on every reactive change but only matters during actual drag (which calls it directly in event handlers).
- **Verify:** `npm run typecheck && npm run build` -- both pass

---

## Phase 2: Debounce search input

**Goal:** Avoid O(n) filter + full tree re-render on every keystroke.

### Task 2.1: Add debounced query signal to search state ✅ DONE

- **File:** `frontend/src/features/search/state/search-state.js`
- **What:** Introduce `_debouncedQuery` signal that updates 150ms after the last keystroke. The `results` computed reads from `_debouncedQuery`, not `query`.
- **How:** Added `_debouncedQuery` signal, `debounceTimer`, `scheduleDebouncedQuery()` helper, and `_debounceEffect` that tracks `query` and schedules debounced updates. `results` computed now reads `_debouncedQuery()`.
- **Verify:** `npm run typecheck && npm run build` -- both pass

### Task 2.2: Clean up debounce timer on state disposal ✅ DONE

- **File:** `frontend/src/features/search/state/search-state.js`
- **What:** Expose a `dispose()` method that clears the pending timer and stops the debounce effect.
- **How:** Added `searchState.dispose()` that calls `clearTimeout(debounceTimer)` and `_debounceEffect()`. Wired into `app/lifecycle.js` `handleBeforeUnload` cleanup chain.
- **Verify:** `npm run typecheck && npm run build` -- both pass

---

## Phase 3: Flat node index (O(1) lookups)

**Goal:** Replace recursive tree traversal for `getNodeById` with a computed Map index.

### Task 3.1: Build a computed node index Map ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** Add a `computed()` that builds a `Map<string, TreeNode>` from the tree signal.
- **How:** Added `nodeIndex` computed that walks the tree once and populates a Map. Rebuilt only when `tree()` signal changes.
- **Verify:** `npm run typecheck && npm run build` -- both pass

### Task 3.2: Replace `getNodeById` with Map lookup ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** Change `getNode(id)` to use `nodeIndex().get(id) ?? null`.
- **How:** One-line swap. Hot path for every tree row render and search result row render.
- **Verify:** `npm run typecheck && npm run build` -- both pass

### Task 3.3: Replace `selectedNodeIds` array with a Set for `isSelected` ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** `isSelected()` did `selectedNodeIds().includes(id)` -- O(n) array scan.
- **How:** Added `selectedNodeIdsSet` computed (`new Set(selectedNodeIds())`). Changed `isSelected(id)` to `selectedNodeIdsSet().has(id)` -- O(1).
- **Verify:** `npm run typecheck && npm run build` -- both pass

### Task 3.4: Audit remaining callers of `getNodeById` in structure.js

- **File:** `frontend/src/features/tree/state/structure.js`
- **What:** `getAncestorIds`, `getSiblingIds`, `getParentIdById`, `getChildIndexById` all call `getNodeById` / `findNode` recursively.
- **How:** These are called during mutations (select, toggle, move), not during render. The render hot path is now covered by `nodeIndex`. Leave structure.js functions as-is -- they're not on the critical path and the optimization cost/benefit doesn't justify the added complexity.
- **Status:** Deferred -- not on the render critical path.

---

## Phase 4: Optimize DnD class synchronization

**Goal:** Only update CSS classes on the rows that actually changed, not all visible rows.

### Task 4.1: Track previous drop target and only update changed rows ✅ DONE

- **File:** `frontend/src/features/tree/interactions/bookmark-tree-dnd.js`
- **What:** Replace `querySelectorAll(".tree-row")` + full iteration with targeted updates.
- **How:** Added `previousDropTargetId` and `previousDragSourceId` tracking variables. `syncDropTargetClasses()` now only clears classes on the previous target/source row and sets classes on the new target/source row using `[data-node-id]` lookups.
- **Verify:** `npm run typecheck && npm run build` -- both pass

---

## Phase 5: Use `when()` for detail panel rendering

**Goal:** Replace manual unmount/mount cycle with NAF's built-in conditional rendering.

### Task 5.1: Refactor detail panel to use `when()` ✅ DONE

- **File:** `frontend/src/features/detail/view/detail-panel.js`
- **What:** Replace the manual `currentComponent?.unmount(); mount(newComponent)` effect pattern with `when()` from naf.js.
- **How:** Built a template that nests two `when()` calls: outer checks `selectionCount > 1` (bulk vs single), inner checks for a valid selected node (single detail vs empty state). Meta text updated in a separate effect. Component mounted once into `shell.content`.
- **Verify:** `npm run typecheck && npm run build` -- both pass

---

## Phase 6: Per-row DOM query optimization (optional) ✅ DONE

**Goal:** Reduce querySelector calls per row mount.

### Task 6.1: Use direct child access for tree rows

- **File:** `frontend/src/features/tree/view/bookmark-tree-row.js`
- **What:** Replace 6 `querySelector()` calls with direct DOM access.
- **How:** `row.children[0]` through `row.children[5]` with `/** @type {HTMLElement} */` casts. Added template structure comment documenting the child order. Removed `$` import (no longer needed).
- **Also:** Same optimization applied to `bookmark-search-result-row.js` (3 querySelector → 3 direct children).
- **Risk:** Fragile if template structure changes. Mitigated with inline comment referencing template.
- **Verify:** `npm run typecheck && npm run build` -- both pass

---

## Verification Checklist (after each task)

- [ ] `cd frontend && npm run typecheck` passes
- [ ] `cd frontend && npm run build` succeeds
- [ ] No behavioral regression in tree rendering
- [ ] No behavioral regression in search
- [ ] No behavioral regression in DnD
