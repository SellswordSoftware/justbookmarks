# Migration Plan: globals.d.ts as single typing source

## Goal

Replace `types.js` and `naf.d.ts` with `globals.d.ts` as the sole type declaration file. All types become ambient globals -- no more `@typedef {import("../../types.js").X} X` boilerplate in every file.

## Current state

- `types.js`: JSDoc typedefs for domain types (23 unique types), imported by 30 files via `@typedef {import(...).Type}`
- `naf.d.ts`: Exported NAF runtime types (Component, Signal, etc.), nobody imports from it
- `globals.d.ts`: Already has all domain types + NAF types + Window augmentation, included in jsconfig.json

## Phase 1: Update globals.d.ts

### 1a. Add missing type aliases

globals.d.ts already has all domain types as interfaces. Two types from types.js are defined as aliases, not interfaces:

- `NodeType` -- currently `type NodeType = 0 | 1;` in globals.d.ts (already correct)
- `TimestampValue` -- currently `type TimestampValue = string;` in globals.d.ts (already correct)

No additions needed. All 23 types from types.js already exist in globals.d.ts.

### 1b. Add Wails Window augmentation (already present)

The `Window` interface augmentation is already in globals.d.ts. Verify it covers both `window.go.main.App` and `window.go.wailsapi.Handler` paths.

### 1c. Update jsconfig.json

globals.d.ts is already included via `src/**/*.d.ts` in jsconfig.json. No change needed.

## Phase 2: Remove types.js imports from JS files

For each file that has `@typedef {import("...types.js").X} X` lines, remove those lines entirely. The types are now ambient.

**Files and lines to remove (43 total):**

| File | Lines to remove |
|------|----------------|
| `src/app/create-app.js` | 1 |
| `src/shared/state/ui-state.js` | 4 |
| `src/shared/state/app-state.js` | 2 |
| `src/shared/infra/persistence.js` | 3 |
| `src/shared/api/api.js` | 10 (BookmarkCreate, BookmarkPatch, TreeNode, BookmarkIndexEntry, FolderMergeItem, BookmarkMergeItem, BookmarkConflictItem, MergePreview, MergeApplyResult, HistoryState) |
| `src/components/toast/toast-container.js` | 1 |
| `src/features/import-merge/import-merge-state.js` | 1 |
| `src/features/import-merge/import-merge-dialog-preview.js` | 2 (@param references) |
| `src/features/import-merge/import-merge-dialog-interactions.js` | 1 (@param reference) |
| `src/features/move/move-dialog.js` | 1 |
| `src/features/move/move-dialog-state.js` | 3 (+ 1 @returns reference) |
| `src/features/detail/actions/bookmark-detail-actions.js` | 1 |
| `src/features/detail/view/detail-panel.js` | 1 (+ 1 @returns reference) |
| `src/features/detail/view/bulk-selection-detail.js` | 3 (@param/@returns references) |
| `src/features/detail/view/bookmark-detail.js` | 1 |
| `src/features/detail/view/folder-detail.js` | 1 |
| `src/features/search/state/search-state.js` | 1 |
| `src/features/shortcuts/global-shortcuts-tree-actions.js` | 2 (@param/@returns references) |
| `src/features/tree/view/bookmark-search-result-row.js` | 1 (@param reference) |
| `src/features/tree/view/bookmark-tree.js` | 1 |
| `src/features/tree/view/bookmark-tree-row.js` | 1 (+ 1 @returns reference) |
| `src/features/tree/state/tree-state.js` | 1 (@returns reference) |
| `src/features/tree/state/selection.js` | 1 |
| `src/features/tree/state/expansion.js` | 2 |
| `src/features/tree/state/structure.js` | 3 |
| `src/features/tree/state/persistence.js` | 2 |
| `src/features/tree/state/normalize.js` | 1 |
| `src/features/tree/interactions/bookmark-tree-dnd.js` | 1 (@param reference) |

### 2b. Also remove inline type references

Some files use inline `import("...types.js").Type` in @param/@returns/@type annotations without a typedef alias. These also need to be simplified to just the type name:

| File | Pattern to change |
|------|-------------------|
| `src/features/shortcuts/global-shortcuts-tree-actions.js` | `@param {import("...types.js").TreeNode} node` -> `@param {TreeNode} node` |
| `src/features/shortcuts/global-shortcuts-tree-actions.js` | `@returns {node is import("...types.js").FolderNode}` -> `@returns {node is FolderNode}` |
| `src/features/move/move-dialog-state.js` | `@returns {node is import("...types.js").FolderNode}` -> `@returns {node is FolderNode}` |
| `src/features/detail/view/detail-panel.js` | `@returns {node is import("...types.js").FolderNode}` -> `@returns {node is FolderNode}` |
| `src/features/detail/view/bulk-selection-detail.js` | 4 inline references -> bare type names |
| `src/features/tree/view/bookmark-search-result-row.js` | `@param {() => import("...types.js").BookmarkIndexEntry}` |
| `src/features/tree/view/bookmark-tree-row.js` | `@returns {node is import("...types.js").FolderNode}` |
| `src/features/tree/state/tree-state.js` | `@returns {import("...types.js").VisibleTreeNodeEntry[]}` |
| `src/features/tree/interactions/bookmark-tree-dnd.js` | `@param {import("...types.js").VisibleTreeNodeEntry}` |
| `src/features/import-merge/import-merge-dialog-preview.js` | 2 inline @param references |
| `src/features/import-merge/import-merge-dialog-interactions.js` | 1 inline @param reference |

## Phase 3: Remove naf.js type imports

Replace `import(".../shared/runtime/naf.js").Component<HTMLElement>` with just `Component<HTMLElement>` (already ambient in globals.d.ts).

**Files and changes (13 total):**

| File | Lines to change |
|------|-----------------|
| `src/components/toolbar/toolbar-actions.js` | 1 |
| `src/components/confirm-modal/confirm-modal.js` | 1 |
| `src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js` | 1 |
| `src/features/move/move-dialog.js` | 1 |
| `src/features/import-merge/import-merge-dialog.js` | 1 |
| `src/features/editing/add-folder-form.js` | 1 |
| `src/features/editing/add-bookmark-form.js` | 1 |
| `src/features/detail/view/detail-panel.js` | 3 |
| `src/features/detail/view/bookmark-detail.js` | 1 |
| `src/features/detail/view/bulk-selection-detail.js` | 1 |
| `src/features/detail/view/folder-detail.js` | 1 |

## Phase 4: Delete files

- Delete `frontend/src/types.js`
- Delete `frontend/src/naf.d.ts`

## Phase 5: Verify

```bash
cd frontend
npm run typecheck
npm run build
```

## Risk assessment

- **Low risk** -- all types are already in globals.d.ts, identical to types.js
- **Mechanical change** -- removing lines, no logic changes
- **Typecheck catches everything** -- if a type name is wrong after removing the import, tsc will flag it

## Estimated effort

~56 files touched (29 JS files for types.js removal, 11 JS files for naf.js removal, 2 files deleted). Purely mechanical line removal -- no reasoning required per file.
