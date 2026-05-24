# justbookmarks Review

## Findings

### 1. `Serialize` silently strips all bookmark and folder timestamps on the first save
Severity: high

Files:
- `internal/bookmarks/serializer.go:51-52`
- `internal/bookmarks/serializer.go:82-83`
- `internal/bookmarks/serializer.go:93-100`

Why it matters:
- `Folder.AddDate`, `Folder.LastModified`, `Bookmark.AddDate`, and `Bookmark.LastModified` are all `time.Time`.
- `writeAttrIfSet()` only writes attributes when the incoming value is an `int64`.
- As a result, every auto-save rewrites the HTML without `ADD_DATE` / `LAST_MODIFIED`, permanently dropping metadata that the parser originally preserved.

Recommended fix:
- Make `writeAttrIfSet()` handle `time.Time` and emit Unix seconds when the value is non-zero.
- Add a serializer round-trip test that proves timestamps survive `Parse -> Serialize -> Parse`.

### 2. Save failures are completely swallowed, so the UI can report success while data never reaches disk
Severity: high

Files:
- `internal/wailsapi/handler.go:79`
- `internal/wailsapi/handler.go:90`
- `internal/wailsapi/handler.go:100`
- `internal/wailsapi/handler.go:110`
- `internal/wailsapi/handler.go:121`
- `internal/wailsapi/handler.go:132`
- `internal/wailsapi/handler.go:229-236`

Why it matters:
- The PRD explicitly calls save failures “critical errors”.
- `save()` ignores `os.WriteFile` errors and returns nothing.
- Every mutating API method calls `h.save()` and then returns success even if the write failed.
- This creates the worst failure mode in the app: the UI says the change succeeded, but the bookmark file on disk is unchanged.

Recommended fix:
- Change `save()` to `func (h *Handler) save() error`.
- Propagate that error from every mutating handler method.
- Surface it in the frontend as a blocking error/modal, not just a toast.

### 3. Search is effectively non-functional because the flat index is never loaded or refreshed
Severity: high

Files:
- `frontend/src/lib/stores/searchStore.svelte.js:4-22`
- `frontend/src/lib/stores/treeStore.svelte.js:54-75`
- `frontend/src/lib/stores/treeStore.svelte.js:110-112`

Why it matters:
- `searchStore` only searches `flatIndex`.
- Nothing in `treeStore.loadFile()` or `treeStore.refresh()` ever calls `GetFlatIndex()` or `searchStore.setIndex(...)`.
- The search UI renders, but `getResults()` always filters an empty array.

Recommended fix:
- Refresh the flat index after every file load and every tree mutation.
- Prefer a single `refresh()` path that updates both the normalized tree and the search index together so they cannot drift.

### 4. Bookmark updates cannot clear fields, so users cannot remove notes or intentionally blank a title
Severity: medium

Files:
- `internal/bookmarks/operations.go:91-117`
- `frontend/src/lib/components/BookmarkDetail.svelte:81-85`

Why it matters:
- `UpdateBookmark()` only applies fields when the incoming string is non-empty.
- The edit form sends `title.trim()`, `url.trim()`, and `meta.trim()`.
- This means a user can never clear `meta`, clear `icon` metadata later, or intentionally leave `title` blank to fall back to URL behavior.

Recommended fix:
- Stop using “empty string means ignore” for updates.
- Introduce an explicit patch/update DTO with pointer fields or separate “present vs absent” semantics.
- Add tests for clearing title and notes.

### 5. The manual Move dialog is wired to the wrong node shape and will produce invalid targets
Severity: medium

Files:
- `internal/wailsapi/handler.go:56-69`
- `frontend/src/lib/components/MoveDialog.svelte:17-20`
- `frontend/src/lib/components/MoveDialog.svelte:57-60`

Why it matters:
- `GetAllFolders()` returns raw backend nodes, which only carry folder IDs at `folder.id`.
- `MoveDialog` reads `f.id` and `folder.id`, but those top-level IDs are not added anywhere for this payload.
- Filtering out the current node will fail, and `<option value={folder.id}>` will frequently render `undefined`, making the dialog unusable.

Recommended fix:
- Normalize folder payloads before putting them into `MoveDialog`, or change the dialog to read `folder.folder.id`.
- Filter descendants correctly, not just the selected node itself.
- Add a UI test or at least a small integration assertion around `GetAllFolders()`.

### 6. Drag-and-drop refreshes the tree before the move request finishes and even when it fails
Severity: medium

Files:
- `frontend/src/lib/components/TreeNode.svelte:62-70`

Why it matters:
- `treeStore.refresh()` is called immediately after starting `api.MoveNode(...)`, not after it resolves.
- On failure, the UI still refreshes as if the move succeeded.
- On success, the refresh can race the backend write and briefly repaint stale data.

Recommended fix:
- Make `handleDrop` `async`.
- `await api.MoveNode(...)`, then `await treeStore.refresh()` on success only.
- Leave the tree alone on error except for showing the toast.

### 7. Deleting a bookmark tries to mutate a read-only store property
Severity: medium

Files:
- `frontend/src/lib/components/BookmarkDetail.svelte:127-130`
- `frontend/src/lib/stores/treeStore.svelte.js:114-126`

Why it matters:
- `treeStore` only exposes `selectedNodeId` through a getter.
- `BookmarkDetail` does `treeStore.selectedNodeId = ''`.
- In ES modules this is a write to a getter-only property and is not a safe update path.

Recommended fix:
- Add a `clearSelection()` or reuse `selectNode('')`.
- Avoid direct state mutation through exported store objects.

## Feature Gaps / Improvements

### Missing PRD features
- Folder deletion is not exposed in the UI even though folder deletion with confirmation is in scope for v1.
- The “Move To...” action described in the PRD is not surfaced from the detail panes, even though `MoveDialog.svelte` exists.
- Keyboard tree navigation from the PRD is not implemented.
- “Open in Browser” exists for bookmarks, but reorder arrows and explicit move controls from the detail panel are absent.

### Frontend runtime hygiene
- Multiple components still use clickable `<div>` containers without keyboard handlers or roles.
- `MoveDialog.svelte:6` keeps `nodeToMove` as a plain variable; Svelte already warns that it is non-reactive.
- `SearchBar.svelte` auto-focuses on every reactive pass, not just initial mount, which can steal focus from form editing.

### Testing gaps
- There is no round-trip regression test for timestamp preservation.
- There is no test covering search index refresh after load or mutation.
- There is no integration-level test for the frontend tree normalization layer, which is currently compensating for backend/frontend shape mismatches.

## Verification Used

- `go test ./...`
- `npm run build` in `frontend/`
- `wails build -platform linux/amd64`
