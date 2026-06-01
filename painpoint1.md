# Pain Point 1: Event Listener Boilerplate

## Problem

99 addEventListener calls and 91 removeEventListener calls across the frontend. Every listener requires manual pairing -- add in onMount, remove in cleanup. This is error-prone, tedious, and dominates the onMount surface area.

Current pattern (repeated ~99 times):
```js
// onMount:
el.addEventListener("click", handleClick);

// cleanup:
cleanup.add(() => el.removeEventListener("click", handleClick));
```

## Solution

Add a `listener()` helper to NAF that attaches a listener and returns a cleanup function:

```js
export function listener(el, event, handler) {
  el?.addEventListener(event, handler);
  return () => el?.removeEventListener(event, handler);
}
```

New pattern:
```js
cleanup.add(listener(el, "click", handleClick));
```

This eliminates the manual pairing ceremony. One line replaces two, and the risk of forgetting a removeEventListener goes to zero.

## Expected Impact

- ~99 lines of addEventListener + ~91 lines of removeEventListener become ~99 single-line listener() calls
- Reduction of ~90 lines of boilerplate cleanup code across the codebase
- Zero risk of leaked listeners (cleanup is automatic)
- Null-safe (el?.addEventListener handles missing refs)

## Task Breakdown

### Phase 1: Add the helper to NAF

#### Task 1.1: Replace `$on()` with `listener()` in naf.js
- File: `frontend/src/shared/runtime/naf.js`
- `$on()` is currently defined but never used anywhere in the codebase -- it is dead code
- Remove `$on()` entirely and replace it with `listener()`
- `listener(el, event, handler)` returns a cleanup function, not the element
- Include JSDoc with proper @template typing
- Must handle null/undefined elements safely (el?.addEventListener)

```js
/**
 * Attach an event listener and return a cleanup function.
 *
 * @template {Element} T
 * @param {T | null | undefined} el
 * @param {string} event
 * @param {(...args: any[]) => void} handler
 * @returns {() => void}
 */
export function listener(el, event, handler) {
  el?.addEventListener(event, handler);
  return () => el?.removeEventListener(event, handler);
}
```

#### Task 1.2: Update NAF usage guidelines
- File: `docs/naf-html-usage-guidelines.md`
- Add `listener()` to the Runtime Surface section
- Add a Helper Guide entry explaining when and how to use it
- Note that `$on()` is no longer needed and usage guidance can be removed

### Phase 2: Migrate files (most impacted first)

Each migration task follows the same mechanical pattern:
1. Import `listener` from naf.js
2. Replace `el.addEventListener(...)` + `() => el.removeEventListener(...)` pairs with `listener(el, event, handler)`
3. Run typecheck + build to verify

#### Task 2.1: Migrate bookmark-detail.js (28 listener calls)
- File: `frontend/src/features/detail/view/bookmark-detail.js`
- Lines 244-257: addEventListener calls
- Lines 355-368: removeEventListener cleanup calls
- Replace 14 listener pairs with 14 `listener()` calls
- Expected reduction: ~28 lines -> ~14 lines

#### Task 2.2: Migrate add-bookmark-form.js (18 listener calls)
- File: `frontend/src/features/editing/add-bookmark-form.js`
- Lines 397-403: addEventListener calls
- Lines 438-445: removeEventListener cleanup calls
- Also handle the position listeners (attachPositionListeners/detachPositionListeners)
- Replace 8 listener pairs with 8 `listener()` calls
- Expected reduction: ~16 lines -> ~8 lines

#### Task 2.3: Migrate move-dialog.js (16 listener calls)
- File: `frontend/src/features/move/move-dialog.js`
- Lines 367-368: list() row listeners (row click, toggle click)
- Lines 499-500: dialog-level listeners (backdrop, dialog)
- Lines 501+: more dialog listeners (cancel, confirm, filter, keydown)
- Replace listener pairs with `listener()` calls
- Expected reduction: ~16 lines -> ~8 lines

#### Task 2.4: Migrate import-merge-dialog-interactions.js (14 listener calls)
- File: `frontend/src/features/import-merge/import-merge-dialog-interactions.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~14 lines -> ~7 lines

#### Task 2.5: Migrate folder-detail.js (12 listener calls)
- File: `frontend/src/features/detail/view/folder-detail.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~12 lines -> ~6 lines

#### Task 2.6: Migrate add-folder-form.js (12 listener calls)
- File: `frontend/src/features/editing/add-folder-form.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~12 lines -> ~6 lines

#### Task 2.7: Migrate titlebar.js (11 listener calls)
- File: `frontend/src/components/titlebar/titlebar.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~11 lines -> ~5-6 lines

#### Task 2.8: Migrate confirm-modal.js (10 listener calls)
- File: `frontend/src/components/confirm-modal/confirm-modal.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~10 lines -> ~5 lines

#### Task 2.9: Migrate keyboard-shortcuts-dialog.js (8 listener calls)
- File: `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~8 lines -> ~4 lines

#### Task 2.10: Migrate bulk-selection-detail.js (8 listener calls)
- File: `frontend/src/features/detail/view/bulk-selection-detail.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~8 lines -> ~4 lines

#### Task 2.11: Migrate app-shell-layout.js (8 listener calls)
- File: `frontend/src/layouts/app-shell/app-shell-layout.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~8 lines -> ~4 lines

#### Task 2.12: Migrate toolbar-actions.js (6 listener calls)
- File: `frontend/src/components/toolbar/toolbar-actions.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~6 lines -> ~3 lines

#### Task 2.13: Migrate bookmark-tree-row.js (6 listener calls)
- File: `frontend/src/features/tree/view/bookmark-tree-row.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~6 lines -> ~3 lines

#### Task 2.14: Migrate bookmark-tree.js (10 listener calls)
- File: `frontend/src/features/tree/view/bookmark-tree.js`
- Replace listener pairs with `listener()` calls
- Expected reduction: ~10 lines -> ~5 lines

#### Task 2.15: Migrate remaining files (lifecycle, empty-library-page, global-shortcuts)
- Files:
  - `frontend/src/app/lifecycle.js` (4 calls)
  - `frontend/src/pages/empty-library/empty-library-page.js` (4 calls)
  - `frontend/src/features/shortcuts/global-shortcuts.js` (2 calls)
  - `frontend/src/features/tree/view/bookmark-search-result-row.js` (2 calls)
- Replace listener pairs with `listener()` calls

### Phase 3: Handle special cases

#### Task 3.1: Update Runtime Surface docs to remove $on()
- File: `docs/naf-html-usage-guidelines.md`
- Remove `$on()` from the Runtime Surface list
- Add `listener()` with a clear description
- Note: `$on()` was designed for chaining but never adopted; `listener()` is the single approach

#### Task 3.2: Review model() internal listener management
- File: `frontend/src/shared/runtime/naf.js` (model() function, lines 245-289)
- model() already manages its own addEventListener/removeEventListener internally
- No migration needed, but verify it could use listener() internally for consistency
- This is optional -- model() cleanup is already handled correctly

#### Task 3.3: Review list() row cleanup pattern
- In move-dialog.js list() setup: row listeners are added and removed in the row's return cleanup
- Verify the `listener()` pattern works cleanly inside list() setup callbacks
- The pattern should be: `return cleanupCollector(listener(row, "click", handler), ...)`

### Phase 4: Verification

#### Task 4.1: Run typecheck
```bash
cd frontend && npm run typecheck
```

#### Task 4.2: Run build
```bash
cd frontend && npm run build
```

#### Task 4.3: Verify listener count reduction
- Count remaining addEventListener/removeEventListener pairs outside of naf.js
- Confirm the reduction matches expectations (~99 -> ~5, since naf.js itself has 5 internal calls)

## Implementation Order

1. Phase 1 (Tasks 1.1, 1.2) -- add the helper and update docs
2. Phase 2, starting with Task 2.1 (bookmark-detail.js) -- the most impacted file
3. Continue through Phase 2 tasks in order (highest impact first)
4. Phase 3 -- handle edge cases
5. Phase 4 -- verify everything works

## Notes

- This is a purely mechanical migration -- no behavior change
- Each file migration is independent and can be committed separately
- The `listener()` helper is null-safe, so refs that might be missing are handled gracefully
- Worker files (search-worker.js, tree-worker.js) use MessageChannel listeners -- these are not DOM event listeners and should NOT be migrated
- The `cleanupCollector` already exists and is used in 14 places -- `listener()` complements it by providing the cleanup function directly
