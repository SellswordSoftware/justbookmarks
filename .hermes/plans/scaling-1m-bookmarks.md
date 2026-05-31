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

## Phase 2: Virtual scrolling + lazy loading

**Goal:** Don't send the full tree to the frontend. Send only root nodes initially, then fetch folder children on-demand when the user expands a folder. Render only the visible viewport with virtual scrolling.

### Task 2.1: Add GetFolderChildren endpoint to Go

- **File:** `internal/wailsapi/handler.go`
- **What:** New method `GetFolderChildren(folderID string) []FlatNodeDTO` that finds the folder in memory and returns its direct children as flat DTOs.
- **Also:** Add `GetRootNodes() []FlatNodeDTO` for initial load.
- **Verify:** `go build ./...`

### Task 2.2: Add Go endpoints to frontend API

- **File:** `frontend/src/shared/api/api.js`
- **What:** Export `GetRootNodes()` and `GetFolderChildren(folderId)`.
- **Verify:** `npm run typecheck`

### Task 2.3: Redesign tree-state for lazy loading

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** Change the tree signal from a full tree to a lazy-loaded tree.
- **Key changes:**
  - `tree()` still holds `TreeNode[]` but folders have a `loaded` flag
  - `FolderNode` gains `children: TreeNode[]` and `childrenLoaded: boolean`
  - New action: `loadFolderChildren(folderId)` -- calls `GetFolderChildren()`, normalizes, patches the folder node in the tree
  - `loadFile()` calls `GetRootNodes()` instead of `GetFlatTree()`
  - `getVisibleNodeEntries()` skips children of unloaded folders (treats them as collapsed)
- **Verify:** `npm run typecheck && npm run build`

### Task 2.4: Wire lazy loading into tree interaction

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** In `toggleExpand()`, if the folder is not yet loaded, call `loadFolderChildren()` before expanding.
- **File:** `frontend/src/features/tree/interactions/bookmark-tree-keyboard.js`
- **What:** Ensure keyboard expand also triggers lazy loading.
- **Verify:** `npm run typecheck && npm run build`

### Task 2.5: Add virtual scrolling to list rendering

- **File:** `frontend/src/shared/runtime/naf.js`
- **What:** Add an optional `virtual` configuration to `list()`:
  ```js
  list(container, template, items, key, setup, {
    virtual: {
      rowHeight: 32,    // fixed pixel height per row
      containerHeight: () => container.scrollHeight, // or fixed
    }
  })
  ```
- **How:**
  - Calculate visible range from `scrollTop` / container height
  - Only create DOM nodes for visible items
  - Use a spacer element (`height: totalHeight`) and `translateY` for positioning
  - Listen to `scroll` events and update the visible window
  - Reuse the existing key-based diffing for the visible subset
- **Verify:** `npm run typecheck && npm run build`

### Task 2.6: Enable virtual scrolling for the tree list

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Pass `virtual: { rowHeight: 32 }` to the `list()` call in `mountListForMode()`.
- **Also:** Set a fixed `height` and `overflow-y: auto` on `shell.treeList` via CSS.
- **Verify:** `npm run typecheck && npm run build`

### Task 2.7: Handle search mode separately

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Search results should also use virtual scrolling (search can return thousands of results).
- **Verify:** `npm run typecheck && npm run build`

### Task 2.8: Validate with 1M file

- **What:** Load the 1M test file. Expected behavior:
  - Initial load: only 100K root folders sent (~5-10MB JSON)
  - Expanding a folder: fetches 6 children (<1ms)
  - Scrolling: smooth, only ~20 DOM nodes at a time
  - Memory: frontend holds only loaded subtrees + viewport DOM

---

## Phase 3: Web Workers for heavy computation

**Goal:** Offload CPU-intensive work from the main thread. Prevents UI freezing during tree normalization, index building, and search indexing.

### Task 3.1: Set up Vite worker configuration

- **File:** `frontend/vite.config.js`
- **What:** Ensure Vite handles `.worker.js` files (inline workers via `?worker` or `?sharedworker` query param).
- **Verify:** `npm run build`

### Task 3.2: Create tree-worker for normalization

- **File:** `frontend/src/features/tree/workers/tree-worker.js` (new)
- **What:** Dedicated worker that receives flat DTOs and returns normalized `TreeNode[]`.
- **Messages:**
  - `normalizeFlat` -> sends `FlatNodeDTO[]`, receives `TreeNode[]`
  - `buildNodeIndex` -> sends `TreeNode[]`, receives `{ entries: [id, nodeSummary][] }` (Map can't be cloned, send as array)
- **Verify:** Worker loads without errors

### Task 3.3: Create search-worker for indexing

- **File:** `frontend/src/features/search/workers/search-worker.js` (new)
- **What:** Dedicated worker that builds the flat search index from the tree.
- **Messages:**
  - `buildIndex` -> sends `TreeNode[]`, receives `BookmarkIndexEntry[]`
- **Verify:** Worker loads without errors

### Task 3.4: Wire tree-worker into load path

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** In `syncTreeState()`, send flat data to tree-worker, receive normalized tree. Use `structuredClone` or transferable objects where possible.
- **Pattern:**
  ```js
  const normalized = await treeWorker.normalizeFlat(flatData);
  tree(normalized);
  ```
- **Verify:** `npm run typecheck && npm run build`

### Task 3.5: Wire search-worker into load path

- **File:** `frontend/src/features/tree/state/tree-state.js`
- **What:** After tree is set, send it to search-worker for index building.
- **Verify:** `npm run typecheck && npm run build`

### Task 3.6: Add loading indicator during worker processing

- **File:** `frontend/src/features/tree/view/bookmark-tree.js`
- **What:** Show a progress/loading state while the worker is processing. The `loading` signal already exists in tree-state -- wire it to show/hide a spinner or skeleton.
- **Verify:** Visual check in app

### Task 3.7: Validate with 1M file

- **What:** Load the 1M file with all three phases active.
- **Expected:**
  - UI remains responsive during load (loading indicator visible)
  - Worker handles normalization + indexing off-main-thread
  - Lazy loading means only root nodes are processed initially
  - Total load time: under 10 seconds for initial render

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
