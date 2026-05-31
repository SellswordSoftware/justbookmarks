# Scaling to 1M+ Bookmarks

Three phases: flat serialization, virtual scrolling with lazy loading, and web workers.

Each task is self-contained and verifiable. Complete in order -- later tasks build on earlier ones.

---

## Phase 1: Flat serialization ✅ DONE

**Goal:** Replace the nested JSON tree with a flat array from Go. Eliminates nested object wrappers, cuts JSON payload by 40-60%, and speeds serialization/parsing on both sides.

### Task 1.1: Add FlatNodeDTO to Go ✅ DONE

- **File:** `internal/bookmarks/model.go`
- **What:** Added `FlatNode` struct -- a flat representation with `parentId` instead of nesting. Fields: id, type, parentId, name, url, icon, iconURI, addDate, lastModified, meta, childCount.
- **Verify:** `go build ./...`

### Task 1.2: Add FlattenTree helper ✅ DONE

- **File:** `internal/bookmarks/flatten.go` (new)
- **What:** Iterative tree walk using explicit stack (avoids recursion depth issues). Produces `[]FlatNode`.
- **Verify:** `go test ./internal/bookmarks/...` -- 4 tests (empty, flat, nested, childCount)

### Task 1.3: Add GetFlatTree endpoint to Handler ✅ DONE

- **File:** `internal/wailsapi/handler.go`
- **What:** New `GetFlatTree() []bookmarks.FlatNode` method.
- **Also:** Ran `wails generate module` to regenerate frontend bindings.
- **Verify:** `go build ./...`

### Task 1.4: Add GetFlatTree to frontend API ✅ DONE

- **File:** `frontend/src/shared/api/api.js`
- **What:** Export `GetFlatTree()` with type cast through `unknown` (Wails generates `type: number`, frontend uses `type: NodeType` = 0 | 1).
- **File:** `frontend/src/globals.d.ts`
- **What:** Added `FlatNode` interface to global types.
- **Verify:** `npm run typecheck`

### Task 1.5: Add flat-to-tree normalizer ✅ DONE

- **File:** `frontend/src/features/tree/state/normalize-flat.js` (new)
- **What:** Converts `FlatNode[]` to `TreeNode[]`. Algorithm: iterate flat array, build each node, maintain `Map<parentId, parentNode>`, push into parent's children. Root nodes (`parentId === ""`) go into root array.
- **Verify:** `npm run typecheck`

### Task 1.6: Switch load path to flat serialization ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** `syncTreeState()` now calls `GetFlatTree()` + `normalizeFlat()` instead of `GetTree()` + `normalizeTree()`. Removed `normalizeTree` import.
- **Cleanup:** Removed unused `GetTree()` export from `api.js`.
- **Verify:** `npm run typecheck && npm run build`

### Task 1.7: Measure and validate ✅ DONE

- **JS bundle:** 116.96 KB (down from 117.58 KB -- old normalizeTreeNode/normalizeTree code is dead, though `normalizeTreeNode` is kept for `GetAllFolders()`).
- **Go tests:** All pass (`go test ./internal/...`).
- **Frontend:** typecheck + build pass.
- **Note:** Full performance measurement requires running the Wails app with test bookmark files. The JSON payload is now a flat array instead of nested objects -- each node is a single flat object rather than a wrapper containing folder/bookmark sub-objects with nested children arrays.

---

## Phase 2: Virtual scrolling + lazy loading ✅ DONE

**Goal:** Don't send the full tree to the frontend. Send only root nodes initially, then fetch folder children on-demand when the user expands a folder. Render only the visible viewport with virtual scrolling.

### Task 2.1: Add GetFolderChildren endpoint to Go ✅ DONE

- **File:** `internal/wailsapi/handler.go`
- **What:** Added `GetFolderChildren(folderID string) []FlatNodeDTO` and `GetRootNodes() []FlatNodeDTO`.
- **Also:** Ran `wails generate module` to regenerate frontend bindings.
- **Verify:** `go build ./...`

### Task 2.2: Add Go endpoints to frontend API ✅ DONE

- **File:** `frontend/src/shared/api/api.js`
- **What:** Added `GetRootNodes()` and `GetFolderChildren(folderId)` exports.
- **Verify:** `npm run typecheck`

### Task 2.3: Redesign tree-state for lazy loading ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** Implemented lazy-loaded tree state.
- **Key changes:**
  - `tree()` holds `TreeNode[]` with folders having `childrenLoaded` flag
  - `FolderNode` has `children: TreeNode[]` and `childrenLoaded: boolean`
  - `loadFolderChildren(folderId)` -- calls `GetFolderChildren()`, normalizes, patches folder in place, notifies via `tree([...currentTree])`
  - `loadFile()` calls `syncRootNodes()` which uses `GetRootNodes()` instead of `GetFlatTree()`
  - `getVisibleNodeEntries()` only shows children of loaded/expanded folders
- **Verify:** `npm run typecheck && npm run build`

### Task 2.4: Wire lazy loading into tree interaction ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** `toggleExpand()` calls `loadFolderChildren()` when folder is not yet loaded, then expands.
- **Verify:** `npm run typecheck && npm run build`

### Task 2.5: Add virtual scrolling to list rendering ✅ DONE

- **File:** `frontend/src/shared/runtime/naf.js`
- **What:** Added `listVirtual()` internal function. `list()` accepts `{ virtual: { rowHeight } }` option.
- **How:**
  - Spacer element provides scrollable height
  - Rows are absolutely positioned children of the spacer
  - Scroll listener with `requestAnimationFrame` throttling
  - Key-based diffing for visible subset
  - Cleanup removes spacer and resets container styles
- **Verify:** `npm run typecheck && npm run build`

### Task 2.6: Enable virtual scrolling for the tree list ✅ DONE

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Added `ROW_HEIGHT = 32` constant. Pass `{ virtual: { rowHeight: ROW_HEIGHT } }` to `list()` calls.
- **Also:** CSS updates to `.tree-pane__list` (flex column, `overflow: hidden`) and `#tree-list` (`flex: 1; min-height: 0`).
- **Verify:** `npm run typecheck && npm run build`

### Task 2.7: Handle search mode separately ✅ DONE

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Search results use virtual scrolling with same `ROW_HEIGHT`.
- **Verify:** `npm run typecheck && npm run build`

### Task 2.8: Bug fixes ✅ DONE

- **Empty-state placeholder conflict:** `mount(component, host)` calls `replaceChildren()` which destroys the virtual list spacer. Fixed by using `component.mount(host)` which appends instead.
- **Template component unmount:** Added `element.remove()` in unmount cleanup to properly remove mounted DOM.
- **Signal notification:** `loadFolderChildren()` calls `tree([...currentTree])` after patching children to notify subscribers.

### Task 2.8: Validate with 1M file ⏳ Pending

- **What:** Load the 1M test file. Expected behavior:
  - Initial load: only 100K root folders sent (~5-10MB JSON)
  - Expanding a folder: fetches 6 children (<1ms)
  - Scrolling: smooth, only ~20 DOM nodes at a time
  - Memory: frontend holds only loaded subtrees + viewport DOM
- **Status:** Code is functional, manual testing with test files needed.

---

## Phase 3: Web Workers for heavy computation ✅ DONE

**Goal:** Offload CPU-intensive work from the main thread. Prevents UI freezing during tree normalization, index building, and search indexing.

### Task 3.1: Set up Vite worker configuration ✅ DONE

- **File:** `frontend/vite.config.js`
- **What:** Existing Vite config supports module workers created with `new Worker(new URL(..., import.meta.url), { type: "module" })`.
- **Verify:** `npm run build` emits separate `tree-worker` and `search-worker` chunks.

### Task 3.2: Create tree-worker for normalization ✅ DONE

- **File:** `frontend/src/features/tree/workers/tree-worker.js` (new)
- **What:** Dedicated worker that receives flat DTOs and returns normalized `TreeNode[]`.
- **Messages:**
  - `normalizeFlat` -> sends `FlatNodeDTO[]`, receives `TreeNode[]`
  - `buildNodeIndex` -> sends `TreeNode[]`, receives `{ entries: [id, nodeSummary][] }` (Map can't be cloned, send as array)
- **Also:** Added `frontend/src/features/tree/workers/tree-worker-client.js` for request/response handling and synchronous fallback.
- **Verify:** Browser smoke test loads `tree-worker.js?worker_file&type=module`.

### Task 3.3: Create search-worker for indexing ✅ DONE

- **File:** `frontend/src/features/search/workers/search-worker.js` (new)
- **What:** Dedicated worker that builds the flat search index from the tree.
- **Messages:**
  - `buildIndex` -> sends `TreeNode[]`, receives `BookmarkIndexEntry[]`
- **Also:** Added `frontend/src/features/search/workers/search-worker-client.js` for request/response handling and synchronous fallback.
- **Verify:** Browser smoke test loads `search-worker.js?worker_file&type=module` during full refresh and returns the expected `BookmarkIndexEntry[]`.

### Task 3.4: Wire tree-worker into load path ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** `syncRootNodes()`, `loadFolderChildren()`, and `syncTreeState()` send flat data to tree-worker and receive normalized trees.
- **Pattern:**
  ```js
  const normalized = await normalizeFlatInWorker(flatData);
  tree(normalized);
  ```
- **Verify:** `npm run typecheck && npm run build`

### Task 3.5: Wire search-worker into load path ✅ DONE

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** Full-tree refreshes send the complete normalized tree to search-worker for index building.
- **Note:** Initial lazy load still uses `GetFlatIndex()` from Go so search remains complete even though the frontend tree only contains root nodes and expanded folders.
- **Verify:** `npm run typecheck && npm run build`

### Task 3.6: Add loading indicator during worker processing ✅ DONE

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Show a spinner-backed loading state while `treeState.loading` is active.
- **File:** `frontend/src/features/tree/styles/tree-list.css`
- **What:** Added compact loading-state layout for the existing empty-state surface.
- **Verify:** Browser smoke test with mocked Wails bindings.

### Task 3.7: Validate with 1M file

- **What:** Load the 1M file with all three phases active.
- **Expected:**
  - UI remains responsive during load (loading indicator visible)
  - Worker handles normalization + indexing off-main-thread
  - Lazy loading means only root nodes are processed initially
  - Total load time: under 10 seconds for initial render
- **Status:** Not manually validated in the Wails desktop runtime during this implementation pass. Automated checks and browser smoke tests pass.

---

## Migration notes

- Phase 1 is backward-compatible -- `GetTree()` can coexist with `GetFlatTree()` during migration
- Phase 2 changes the frontend state model -- plan for a migration period where both full-tree and lazy-tree modes work
- Phase 3 is additive -- workers are used alongside existing code paths
- At each phase boundary, verify with `npm run typecheck && npm run build` and manual testing with the test bookmark files

## Test files

Located in `frontend/test-data/`:
- `bookmarks-10k.html` -- 10,000 bookmarks, 0.74 MB (quick smoke test)
- `bookmarks-100k.html` -- 100,000 bookmarks, 7.46 MB (performance baseline)
- `bookmarks-1m.html` -- 1,000,000 bookmarks, 74.75 MB (upper limit test)

Generated with `node frontend/scripts/generate-test-bookmarks.js [path] [iterations]`.
