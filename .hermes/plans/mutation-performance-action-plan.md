# Mutation Performance Action Plan

Goal: make add bookmark, add folder, and move operations feel immediate on very large bookmark files by avoiding full frontend tree refreshes and reducing backend full-tree work where practical.

Context: Loading the 1M bookmark file is now acceptable after flat serialization, lazy tree loading, virtual scrolling, and worker-backed normalization. The remaining slow paths are mutations that still reload or rebuild too much state after a small change.

## Current Bottlenecks

- Frontend calls `treeState.actions.refresh()` after add and move operations, which reloads the full tree, normalizes it, and rebuilds search indexing.
- Backend `executeSnapshotCommand()` deep-clones the full tree before and after every mutation for undo/redo snapshots.
- Backend saves by serializing and writing the full Netscape HTML file after every mutation.
- Add operations scan the full tree to detect the newly created ID even though the operation can know the created node directly.
- Move operations return no changed-node payload, so the frontend cannot patch the lazy tree incrementally.

## Phase A: Targeted Add Patching

### Task A1: Return Created Flat Nodes From Add APIs

- [x] Change `Handler.AddBookmark(parentID, bookmark)` to return `bookmarks.FlatNode` instead of only the created ID.
- [x] Change `Handler.AddFolder(parentID, name)` to return `bookmarks.FlatNode` instead of only the created ID.
- [x] Remove the `collectNodeIDs()` / `findNewNodeID()` full-tree scans from add handlers.
- [x] Update Wails frontend bindings.
- [x] Update `frontend/src/shared/api/api.js` return types.

Acceptance criteria:

- Add bookmark/folder responses include the created node id, type, parent id, display fields, and child count.
- Adding one node does not scan the full tree just to discover the new ID.
- `go test ./internal/bookmarks/... ./internal/wailsapi/...` passes.
- `npm run typecheck && npm run build` passes.

### Task A2: Add Frontend Tree Insert Actions

- [x] Add `treeState.actions.insertFlatNode(parentId, flatNode, index?)`.
- [x] If `parentId === ""`, insert into root tree.
- [x] If parent is loaded, insert into `parent.folder.children`.
- [x] If parent is not loaded or absent from the lazy tree, do not force a full refresh; mark enough state so selection can degrade gracefully.
- [x] Notify the tree signal with a shallow copy after successful insertion.
- [x] Update search index for new bookmarks only.

Acceptance criteria:

- Adding a root bookmark/folder appears immediately without full refresh.
- Adding under a loaded folder appears immediately without full refresh.
- Adding under an unloaded folder does not expand or load the folder unnecessarily.
- Search can find a newly added bookmark when title/url are present.

### Task A3: Wire Add Bookmark Form to Targeted Insert

- [x] Replace `treeState.actions.refresh()` in `frontend/src/features/editing/add-bookmark-form.js`.
- [x] Insert the returned `FlatNode` into the lazy tree.
- [x] Select the new bookmark if it is present in the loaded tree.
- [x] Fall back to refresh only if insertion fails in an unexpected state.

Acceptance criteria:

- Add bookmark on 1M file does not reload the full tree.
- UI remains responsive after submit.
- New bookmark is selected when inserted into a loaded parent.

### Task A4: Wire Add Folder Form to Targeted Insert

- [x] Replace `treeState.actions.refresh()` in `frontend/src/features/editing/add-folder-form.js`.
- [x] Insert the returned `FlatNode` into the lazy tree.
- [x] Select the new folder if it is present in the loaded tree.
- [x] Fall back to refresh only if insertion fails in an unexpected state.

Acceptance criteria:

- Add folder on 1M file does not reload the full tree.
- UI remains responsive after submit.
- New folder appears immediately when parent is loaded.

## Phase B: Targeted Move Patching

### Task B1: Return Move Metadata From Backend

- [x] Add a `MoveResult` DTO in Go with moved node DTOs and parent/index metadata.
- [x] Change `Handler.MoveNode(nodeID, newParentID, newIndex)` to return `MoveResult`.
- [x] Change `Handler.MoveNodes(nodeIDs, targetFolderID)` to return `MoveResult`.
- [x] Capture `oldParentId`, `newParentId`, and final insertion index before/after the operation.
- [x] Return flat DTOs for moved nodes.
- [x] Update Wails frontend bindings and `frontend/src/shared/api/api.js`.

Suggested DTO:

```go
type MoveResult struct {
    MovedNodes  []bookmarks.FlatNode `json:"movedNodes"`
    OldParentID string               `json:"oldParentId"`
    NewParentID string               `json:"newParentId"`
    NewIndex    int                  `json:"newIndex"`
}
```

Acceptance criteria:

- Move APIs provide enough data for the frontend to patch loaded tree state.
- Existing move behavior and validation remain unchanged.
- Go and frontend checks pass.

### Task B2: Add Frontend Move Patch Action

- [x] Add `treeState.actions.applyMoveResult(result)` for loaded-tree move patching.
- [x] Remove the node from its loaded old parent/root if present.
- [x] Insert into the loaded new parent/root if present.
- [x] If old or new parent is not loaded, mark affected loaded state conservatively and avoid a full refresh unless required for visible correctness.
- [x] Preserve selection after move.
- [x] Update search index folder paths for moved bookmarks when determinable.

Acceptance criteria:

- Moving a visible bookmark into a loaded folder updates the tree immediately.
- Moving a visible node between root and loaded folders updates the tree immediately.
- Moving into an unloaded folder does not force full-tree reload.
- Selection remains on the moved node when it is still visible.

### Task B3: Wire Move Dialog to Targeted Move

- [x] Replace `treeState.actions.refresh()` in `frontend/src/features/move/move-dialog.js`.
- [x] Use `MoveResult` to patch tree state.
- [x] Fall back to refresh only if the result cannot be applied.

Acceptance criteria:

- Move via dialog does not reload the full 1M tree for normal visible moves.
- Toast and dialog behavior remain unchanged.

### Task B4: Wire Drag-and-Drop to Targeted Move

- [x] Change `bookmark-tree-dnd.js` `applyDropTarget()` to use the returned `MoveResult`.
- [x] Replace the post-drop full refresh with `treeState.actions.applyMoveResult(...)`.
- [x] Preserve drop-target cleanup and error handling.

Acceptance criteria:

- Dragging a bookmark into a loaded folder patches immediately.
- Dragging before/after visible rows patches ordering correctly.
- Dragging into an unloaded folder does not force a full refresh.

## Phase C: Search Index Correctness After Moves

### Task C1: Patch Search Index for Simple Bookmark Moves

- [x] Add `searchState.actions.patchBookmarkFolderPath(nodeId, folderPath)`.
- [x] Compute folder path from loaded tree when possible.
- [x] Patch moved bookmark search entries after targeted moves.

Acceptance criteria:

- Moving a bookmark to a loaded folder updates search result metadata.
- Search result activation still selects/expands correctly for loaded ancestors.

### Task C2: Handle Folder Moves Conservatively

- [x] Decide whether folder moves should trigger `GetFlatIndex()` instead of full tree refresh.
- [x] For moved folders, rebuild only the search index from Go unless the moved descendants are loaded and can be patched confidently.
- [x] Avoid full tree refresh unless visible tree correctness requires it.

Acceptance criteria:

- Moving a folder keeps search metadata correct.
- Folder move does not reload and normalize the full tree unless needed.

## Phase D: Backend Mutation Cost Reduction

### Task D1: Replace Add Snapshot History With Operation-Specific Undo

- [x] Add an undo command for add bookmark/folder that deletes the created node on undo and re-adds it on redo.
- [x] Avoid full-tree before/after snapshot cloning for add operations.
- [x] Keep save behavior and history labels unchanged.

Acceptance criteria:

- Add operations avoid full-tree snapshot clone cost.
- Undo/redo for add bookmark/folder still works.

### Task D2: Replace Move Snapshot History With Operation-Specific Undo

- [x] Capture old parent and old index before move.
- [x] Add move undo command that moves node(s) back to original location.
- [x] Avoid full-tree snapshot cloning for move operations.

Acceptance criteria:

- Move operations avoid full-tree snapshot clone cost.
- Undo/redo for move still works.

### Task D3: Replace Update Snapshot History With Field-Level Undo

- [ ] Capture old bookmark/folder fields before update.
- [ ] Add update undo commands that restore only changed fields.
- [ ] Use for bookmark edit, folder rename, favicon refresh, and title refresh.

Acceptance criteria:

- Metadata updates avoid full-tree snapshot clone cost.
- Undo/redo still restores edited fields.

## Phase E: Save Latency Reduction

### Task E1: Add Save State Signal

- [ ] Add frontend-visible state for `saving`, `saved`, and `saveError`.
- [ ] Surface it in the titlebar or subtle status area.

Acceptance criteria:

- User can tell when a background save is in progress.
- Save errors are visible.

### Task E2: Coalesce Saves

- [ ] Add backend save queue or debounce around mutations.
- [ ] Mutate memory immediately.
- [ ] Save after a short delay or explicit flush point.
- [ ] Coalesce multiple quick mutations into one file write.

Acceptance criteria:

- Rapid add/move/edit operations do not serialize/write the full file repeatedly.
- App still protects against data loss with an explicit flush on shutdown/window close.

### Task E3: Validate Crash-Safety Tradeoff

- [ ] Decide whether background saves are acceptable for this file-based app.
- [ ] If not acceptable, keep synchronous save but use all earlier targeted patching and command-history improvements.
- [ ] Document the chosen tradeoff.

Acceptance criteria:

- Project has a clear policy for durability vs responsiveness.

## Suggested Implementation Order

1. A1: Return created flat nodes from add APIs.
2. A2: Add frontend insert actions.
3. A3/A4: Wire add bookmark and add folder forms.
4. B1: Return move metadata from backend.
5. B2: Add frontend move patch action.
6. B3/B4: Wire move dialog and drag-and-drop.
7. C1/C2: Fix search metadata after moves.
8. D1-D3: Replace full snapshot history for common operations.
9. E1-E3: Add save state and evaluate/coalesce background saves.

## Verification Checklist

- [ ] `go test ./internal/bookmarks/... ./internal/wailsapi/...`
- [ ] `cd frontend && npm run typecheck`
- [ ] `cd frontend && npm run build`
- [ ] Manual 1M file test: add root bookmark.
- [ ] Manual 1M file test: add bookmark in loaded folder.
- [ ] Manual 1M file test: add root folder.
- [ ] Manual 1M file test: add folder in loaded folder.
- [ ] Manual 1M file test: move bookmark via dialog.
- [ ] Manual 1M file test: move bookmark via drag-and-drop.
- [ ] Manual 1M file test: undo/redo each optimized mutation.
- [ ] Manual 1M file test: confirm no full tree blanking or long UI lock after targeted operations.

## Out Of Scope For This Plan

- Changing the primary storage format away from Netscape HTML.
- Building a local database or sidecar index.
- Full transactional background persistence.
- Search worker redesign beyond incremental index patching needed for add/move.
