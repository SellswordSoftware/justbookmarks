# Multi-Select Implementation Checklist

## Goal

Add tree multi-select for bulk actions with these constraints:

- Multi-select uses desktop-style modifiers:
  - `Ctrl`/`Cmd+click` toggles membership
  - `Shift+click` selects a range
- The first selected node defines the selection domain:
  - if first selected node is a folder, only folders may be added
  - if first selected node is a bookmark, only bookmarks may be added
- Additional selected nodes must be at the same hierarchical level:
  - same parent folder ID
  - or all root-level siblings

This intentionally excludes mixed-type and cross-level multi-selection.

## Selection Rules

Implement these rules explicitly and centrally in the tree selection store:

- `single click`
  - clears prior selection
  - selects clicked node as the only selection
  - updates primary selection
- `Ctrl`/`Cmd+click`
  - if nothing selected: select clicked node
  - if clicked node is compatible with current selection domain: toggle it
  - if incompatible: ignore or show a small toast
- `Shift+click`
  - if no anchor selection exists: behaves like single click
  - if clicked node is compatible with current selection domain:
    - select the contiguous visible range between anchor and clicked node
    - only include compatible nodes in that range
  - if incompatible: ignore or show a small toast
- compatibility means:
  - same node type as anchor
  - same parent folder ID as anchor
  - for root-level items, parent ID is empty string

## UX Rules

- Keep existing single-selection behavior for normal editing.
- When `selectionCount === 1`, right pane behaves exactly as it does today.
- When `selectionCount > 1`, right pane switches to a bulk action panel.
- Tree rows should visually distinguish:
  - primary selected node
  - selected but not primary nodes
  - hovered nodes
- Add a subtle helper hint in the tree footer or header:
  - `Ctrl/Cmd-click to add`
  - `Shift-click for range`
- Disable drag-and-drop whenever multi-selection is active in v1.

## Phase 1: Tree Store Refactor

Files:

- [frontend/src/lib/stores/treeStore.svelte.ts](/home/mike/sellsword/justbookmarks/frontend/src/lib/stores/treeStore.svelte.ts:1)
- [frontend/src/lib/types.ts](/home/mike/sellsword/justbookmarks/frontend/src/lib/types.ts:1)

Tasks:

1. Replace the single `selectedNodeId` model with a richer selection model:
   - `primarySelectedNodeId: string`
   - `selectedNodeIds: string[]`
   - `selectionAnchorNodeId: string`
2. Add derived helpers:
   - `selectionCount`
   - `hasMultiSelection`
   - `isSelected(id)`
   - `getSelectedNodes()`
   - `getPrimarySelectedNode()`
3. Add compatibility helpers:
   - `getNodeType(id)`
   - `getParentNode(id)`
   - `getParentId(id)` returning `''` for root
   - `canJoinSelection(candidateId)`
4. Add selection mutation methods:
   - `selectSingle(id)`
   - `toggleSelected(id)`
   - `selectRange(targetId, visibleIds)`
   - `clearSelection()`
   - `setPrimarySelected(id)`
5. Preserve backward compatibility temporarily:
   - keep `selectedNodeId` getter as alias to `primarySelectedNodeId`
   - update existing callers incrementally
6. On `loadFile()` and `refresh()`:
   - remove invalid selected IDs
   - if primary selection disappears, clear selection

## Phase 2: Visible Tree Ordering Utility

Files:

- [frontend/src/lib/components/BookmarkTree.svelte](/home/mike/sellsword/justbookmarks/frontend/src/lib/components/BookmarkTree.svelte:1)
- possibly move logic into `treeStore` or a helper module

Tasks:

1. Extract or centralize visible tree order computation.
2. Ensure range selection works on the currently visible order:
   - expanded tree order in normal mode
   - filtered result order in search mode if search multi-select is supported
3. Define anchor semantics:
   - anchor is set on single click
   - anchor remains stable across `Ctrl`/`Cmd+click`
   - `Shift+click` uses anchor + visible order

Recommendation:

- Keep v1 range selection only for normal tree view.
- Defer search-results range selection unless trivial.

## Phase 3: Tree Row Interaction Changes

Files:

- [frontend/src/lib/components/TreeNode.svelte](/home/mike/sellsword/justbookmarks/frontend/src/lib/components/TreeNode.svelte:1)
- [frontend/src/lib/components/BookmarkTree.svelte](/home/mike/sellsword/justbookmarks/frontend/src/lib/components/BookmarkTree.svelte:1)

Tasks:

1. Update click handling:
   - plain click -> `selectSingle`
   - `Ctrl`/`Cmd+click` -> `toggleSelected`
   - `Shift+click` -> `selectRange`
2. Update keyboard handling:
   - `Enter` selects primary node
   - `Space` keeps folder expand/collapse behavior
   - optional later: `Shift+Arrow` range extension
3. Add visual states:
   - primary selected row
   - secondary selected rows
4. Disable DnD when `selectionCount > 1`.
5. Make sure folder chevron clicks do not alter selection unexpectedly.

## Phase 4: Detail Panel Bulk State

Files:

- [frontend/src/lib/components/DetailPanel.svelte](/home/mike/sellsword/justbookmarks/frontend/src/lib/components/DetailPanel.svelte:1)
- new component: `BulkSelectionDetail.svelte`

Tasks:

1. Add a bulk-detail component for `selectionCount > 1`.
2. Show:
   - total count selected
   - selected type (`Bookmarks` or `Folders`)
   - parent context if useful
3. Add bulk actions:
   - `Move`
   - `Delete`
   - `Fetch Favicons` for bookmarks only
   - `Refresh Titles` for bookmarks only
4. Disable or hide unsupported actions based on selection type.

## Phase 5: Backend Bulk APIs

Files:

- [internal/wailsapi/handler.go](/home/mike/sellsword/justbookmarks/internal/wailsapi/handler.go:1)
- [internal/bookmarks/operations.go](/home/mike/sellsword/justbookmarks/internal/bookmarks/operations.go:1)
- [frontend/src/lib/api.ts](/home/mike/sellsword/justbookmarks/frontend/src/lib/api.ts:1)
- [frontend/src/vite-env.d.ts](/home/mike/sellsword/justbookmarks/frontend/src/vite-env.d.ts:1)

Tasks:

1. Add batch endpoints:
   - `DeleteNodes(ids []string) error`
   - `MoveNodes(ids []string, targetFolderID string) error`
   - `FetchFaviconsForNodes(ids []string) error`
   - `RefreshTitlesForNodes(ids []string) error`
2. Validate the whole request before saving.
3. Perform one save at the end of each bulk command.
4. For bookmark-only commands:
   - silently skip non-bookmark IDs only if frontend guarantees type purity
   - otherwise return validation error

## Phase 6: Backend Operation Semantics

### Bulk Delete

Rules:

- Selection is same-level and same-type, so execution is simpler.
- Delete selected nodes from their shared parent or root.
- Save once.

Implementation:

- Add helper that deletes multiple sibling IDs in one pass.

### Bulk Move

Rules:

- Selected nodes are siblings by design.
- Move all selected nodes into a target folder, preserving current order.
- Disallow moving into the same parent if that yields no real change in v1, or support append semantics explicitly.

Implementation:

- remove selected sibling nodes in original order
- append or insert them into target folder in the same order
- save once

### Bulk Fetch Favicons

Rules:

- bookmarks only
- fetch in order, continue on per-item failure
- save once after all updates
- return aggregated error only if every fetch fails, or return partial-failure summary

### Bulk Refresh Titles

Rules:

- bookmarks only
- same fetch path as single title fetch
- update title only if fetch succeeds
- save once after all updates

Decision to make before implementation:

- whether this overwrites manually edited titles unconditionally
- recommended v1 rule: yes, because action is explicit and user-triggered

## Phase 7: Move Dialog Integration

Files:

- [frontend/src/lib/components/MoveDialog.svelte](/home/mike/sellsword/justbookmarks/frontend/src/lib/components/MoveDialog.svelte:1)
- [frontend/src/lib/stores/moveDialogStore.svelte.ts](/home/mike/sellsword/justbookmarks/frontend/src/lib/stores/moveDialogStore.svelte.ts:1)

Tasks:

1. Extend move dialog to support:
   - single node move
   - multi-node move
2. Store either:
   - `nodeToMove`
   - or `nodeIdsToMove`
3. Update dialog copy:
   - `Move "Foo"`
   - or `Move 7 bookmarks`
4. Reuse same target-folder filtering rules.

## Phase 8: Search and Selection Interaction

Decision:

- v1 recommendation: search results remain single-select only

Reason:

- range semantics in filtered results add complexity
- same-level constraint becomes less obvious when siblings are hidden by search
- bulk actions are already valuable in normal tree mode

If later enabled:

- only allow multi-select in search if all selected results resolve to same parent and same type

## Phase 9: Error Messaging

Files:

- [frontend/src/lib/stores/uiStore.svelte.ts](/home/mike/sellsword/justbookmarks/frontend/src/lib/stores/uiStore.svelte.ts:1)

Add clear messages for invalid multi-select attempts:

- `Only bookmarks can be added to this selection`
- `Only folders can be added to this selection`
- `Only items from the same level can be selected together`

These should be lightweight toasts, not modal blockers.

## Phase 10: Verification

### Frontend

- add unit or component-level coverage if available for:
  - single click selection
  - `Ctrl`/`Cmd+click` toggle
  - `Shift+click` range
  - incompatible selection rejection
  - detail panel switching to bulk mode

### Backend

Add tests in `internal/bookmarks/operations_test.go` for:

- bulk delete of sibling bookmarks
- bulk delete of sibling folders
- bulk move preserving order
- bulk move from root level
- bulk favicon/title operations on bookmark IDs
- invalid mixed-type or invalid-target errors if backend validates them

### Manual QA

1. Select one bookmark, then `Ctrl`/`Cmd+click` sibling bookmarks: works.
2. Select one bookmark, then `Ctrl`/`Cmd+click` a folder: rejected.
3. Select one bookmark, then `Ctrl`/`Cmd+click` bookmark from another parent: rejected.
4. `Shift+click` selects visible sibling range only.
5. Multi-select disables drag/drop.
6. Bulk delete removes all selected items and saves once.
7. Bulk move preserves selection order.
8. Bulk fetch favicons updates selected bookmarks only.
9. Bulk refresh titles overwrites titles only for selected bookmarks.

## Recommended Delivery Order

1. Tree store selection refactor
2. Tree row click/keyboard behavior
3. Bulk detail panel
4. Bulk delete backend + UI
5. Bulk move backend + UI
6. Bulk fetch favicons backend + UI
7. Bulk refresh titles backend + UI
8. polish and QA

## Recommended v1 Non-Goals

- mixed folder + bookmark selections
- cross-level selections
- drag-and-drop moving of multiple selected nodes
- search-results multi-select
- checkbox selection mode
- partial inline editing of multiple items

## Notes

This constraint set is good. It keeps the mental model simple and dramatically reduces backend complexity:

- selections are homogeneous
- selections are sibling-only
- move/delete can operate on one slice of children or root nodes
- bulk actions avoid the nasty nested-folder cases

That makes this a much safer v1 than unrestricted multi-select.
