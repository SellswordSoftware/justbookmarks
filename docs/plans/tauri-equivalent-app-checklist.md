# Tauri Equivalent App Checklist

Goal: reproduce the current Wails app in `/home/mike/code/tauritest` with frontend parity and a Rust backend that exposes the same frontend API contract.

## Ground Rules

- Keep the frontend markup and styling as close to identical as possible.
- Prefer a compatibility adapter over broad frontend rewrites.
- Preserve the Wails API contract at the JS boundary unless there is a specific Tauri constraint that forces a change.
- Treat this as a migration for comparison purposes, not a redesign.

## Reference Surfaces

### Wails frontend entrypoints

- `frontend/index.html`
- `frontend/src/main.js`
- `frontend/src/shared/api/api.js`
- `frontend/src/components/titlebar/titlebar.js`
- `frontend/src/shared/state/app-state.js`
- `frontend/src/app/window-resize.js`

### Wails backend reference

- `app.go`
- `internal/wailsapi/handler.go`
- `internal/wailsapi/dto.go`
- `internal/bookmarks/*`

### Tauri scaffold target

- `/home/mike/code/tauritest/package.json`
- `/home/mike/code/tauritest/src-tauri/tauri.conf.json`
- `/home/mike/code/tauritest/src-tauri/src/lib.rs`
- `/home/mike/code/tauritest/src-tauri/src/main.rs`

## Phase 1: Restructure The Tauri App

### 1.1 Decide frontend location

- Recommended: keep the copied Wails frontend as the main web app root in `tauritest/frontend`.
- Alternative: flatten into `tauritest/src`.
- Exit criteria:
  - one clear frontend root exists
  - Tauri build points at that root
  - Vite dev/build commands work from that root

### 1.2 Replace the scaffold frontend

- Remove or ignore these scaffold files:
  - `/home/mike/code/tauritest/src/index.html`
  - `/home/mike/code/tauritest/src/main.js`
  - `/home/mike/code/tauritest/src/styles.css`
- Copy these from the Wails app:
  - `frontend/index.html`
  - `frontend/src/*`
  - `frontend/src/assets/*`
  - `frontend/src/styles/*`
  - `frontend/tests/*`
  - `frontend/vite.config.js`
  - `frontend/jsconfig.json`
  - `frontend/package.json`
  - supporting scripts or test data if the Tauri port will use them
- Exit criteria:
  - scaffold greet UI is gone
  - Tauri project contains the Wails frontend files

### 1.3 Normalize frontend package setup

- Add the Wails frontend dependencies and scripts into the Tauri project package manifest.
- Remove Wails-only package dependencies if they are replaced by local adapters.
- Add Tauri JS dependencies required for:
  - `invoke`
  - window control
  - dialog APIs if called from JS
- Exit criteria:
  - `npm install` completes
  - frontend has explicit scripts for `dev`, `build`, `test`, and `tauri`

### 1.4 Update Tauri config

- Update `/home/mike/code/tauritest/src-tauri/tauri.conf.json`:
  - `productName` to `JustBookmarks` or a clearly labeled comparison name
  - `identifier` to a stable app id
  - `build.frontendDist` to the frontend build output
  - `build.devUrl` or `beforeDevCommand` if using Vite dev server
  - window title, width, height, minWidth, minHeight to match Wails
  - frameless window config to match the Wails shell
- Match current Wails window options from `main.go`:
  - title `JustBookmarks`
  - width `1200`
  - height `800`
  - min width `900`
  - min height `640`
  - frameless true
- Exit criteria:
  - Tauri launches the copied frontend
  - window dimensions match Wails startup behavior

## Phase 2: Build The Frontend Compatibility Layer

### 2.1 Replace generated Wails bindings with a local adapter

- Create a local adapter module in the Tauri app, for example:
  - `frontend/src/shared/api/tauri-api-bindings.js`
- Replace imports in `frontend/src/shared/api/api.js` that currently come from:
  - `bindings/.../app.js`
  - `bindings/.../internal/wailsapi/handler.js`
- Keep the exported function names in `api.js` unchanged.
- Exit criteria:
  - no production code imports from `frontend/bindings` or `frontend/wailsjs`
  - frontend still calls the same `api.js` methods

### 2.2 Mirror the Wails command names in Tauri

- Add Tauri invoke wrappers for these app-level methods:
  - `GetFilePath`
  - `OpenFilePicker`
  - `OpenImportFilePicker`
  - `CreateBookmarkFile`
  - `LoadBookmarkFile`
- Add Tauri invoke wrappers for these handler methods:
  - `LoadFile`
  - `GetFlatTree`
  - `GetRootNodes`
  - `GetFolderChildren`
  - `GetFlatIndex`
  - `GetAllFolders`
  - `GetTreeStats`
  - `AddBookmark`
  - `AddFolder`
  - `UpdateBookmark`
  - `UpdateFolderName`
  - `DeleteNode`
  - `DeleteNodes`
  - `MoveNode`
  - `MoveNodes`
  - `PreviewImportMerge`
  - `ApplyImportMerge`
  - `FetchPageTitle`
  - `FetchFavicon`
  - `FetchFaviconsForNodes`
  - `OpenURL`
  - `FilePath`
  - `GetHistoryState`
  - `Undo`
  - `Redo`
- Exit criteria:
  - `api.js` remains the stable frontend contract
  - every method resolves through Tauri invoke

### 2.3 Create a window/runtime adapter

- Replace direct imports from `@wailsio/runtime` in:
  - `frontend/src/components/titlebar/titlebar.js`
  - `frontend/src/shared/state/app-state.js`
- Introduce a small module such as:
  - `frontend/src/shared/runtime/window-host.js`
- Map the following behaviors:
  - minimize
  - toggle maximize
  - check maximized
  - check minimized
  - get size
  - set size
  - close app
- Exit criteria:
  - titlebar buttons work through Tauri
  - persisted window size logic still functions

### 2.4 Replace Wails drag/resize assumptions

- Review `frontend/index.html` drag markup:
  - `data-wails-drag`
  - `style="--wails-draggable: drag"`
- Review titlebar no-drag marker:
  - `data-wails-no-drag`
- Review Linux-specific resize logic in `frontend/src/app/window-resize.js`
- Decide per behavior:
  - keep markup but reinterpret it in Tauri
  - or swap to Tauri-specific drag-region attributes
- For resize:
  - first goal is acceptable parity on supported platforms
  - if Linux frameless manual resize is costly, note it as a known gap and isolate it
- Exit criteria:
  - window can be dragged from the titlebar
  - control buttons do not trigger drag
  - maximize/restore behavior still feels native

## Phase 3: Port Backend Data Contracts To Rust

### 3.1 Port DTOs first

- Create Rust equivalents of:
  - `BookmarkDTO`
  - `BookmarkCreateDTO`
  - `BookmarkPatchDTO`
  - `FolderDTO`
  - `NodeDTO`
  - `MoveResult`
  - `TreeStats`
  - history state shape
- Match JSON field names exactly, including camelCase fields like:
  - `iconURI`
  - `lastModified`
  - `oldParentId`
  - `newParentId`
- Exit criteria:
  - JS receives payloads shaped identically to the Wails app

### 3.2 Port bookmark domain models

- Port core tree models from `internal/bookmarks/model.go`.
- Preserve node identity and node type semantics.
- Preserve timestamp formatting expectations from `internal/wailsapi/dto.go`.
- Exit criteria:
  - Rust can represent all folder/bookmark tree states the Go app supports

## Phase 4: Port Core Bookmark Logic To Rust

### 4.1 Parsing and serialization

- Port:
  - parser
  - serializer
  - flattening helpers
  - flat index builder
- Use the Go tests as the behavioral reference.
- Exit criteria:
  - load existing bookmark HTML
  - serialize back to valid Netscape bookmark HTML

### 4.2 Tree mutation operations

- Port:
  - add bookmark
  - add folder
  - update bookmark
  - update folder name
  - delete node
  - delete nodes
  - move node
  - move nodes
- Preserve targeted frontend patch payload behavior where applicable.
- Exit criteria:
  - all CRUD and move operations persist correctly

### 4.3 Merge support

- Port:
  - merge preview
  - merge apply
- Preserve result counts and categories:
  - folders added
  - bookmarks added
  - duplicates skipped
  - potential updates
- Exit criteria:
  - import merge dialog can preview and apply against the Rust backend

### 4.4 Undo/redo support

- Port command history semantics:
  - snapshot commands
  - move commands
  - add commands
  - update commands
- Preserve history labels returned to the frontend.
- Exit criteria:
  - `Undo`, `Redo`, and `GetHistoryState` behave like Wails

## Phase 5: Implement Tauri Commands And App State

### 5.1 Create shared Rust app state

- Introduce a state container storing:
  - current file path
  - bookmark tree
  - undo stack
  - redo stack
- Use synchronization that is appropriate for Tauri command access.
- Exit criteria:
  - every command can safely access shared mutable state

### 5.2 Implement app-level commands

- Port `app.go` behavior:
  - CLI startup file path
  - open file picker
  - open import file picker
  - create bookmark file
  - load bookmark file into the handler state
- Exit criteria:
  - empty state flow and initial file-open flow both work

### 5.3 Implement handler commands

- Add Tauri commands for the full handler surface.
- Keep command names aligned with the adapter.
- Ensure save-on-mutation behavior matches the Go code.
- Exit criteria:
  - all `api.js` calls round-trip successfully against Rust

## Phase 6: Native Integrations

### 6.1 File dialogs

- Add whatever Tauri plugin or Rust-side integration is needed for:
  - open file
  - save file
- Match file filters used by Wails:
  - `HTML Files`
  - fallback `All Files`
- Exit criteria:
  - user can create, open, and import bookmark files through native dialogs

### 6.2 External URL opening

- Replace `exec.Command` behavior from Go with Tauri-native opener support.
- Exit criteria:
  - opening a bookmark launches the system browser

### 6.3 HTTP fetching parity

- Implement Rust equivalents for:
  - page title fetch
  - favicon fetch
  - batch favicon refresh
- Preserve timeout behavior as closely as practical.
- Exit criteria:
  - edit and bulk-refresh flows behave the same from the frontend perspective

## Phase 7: Remove Wails-Specific Leftovers

- Remove frontend dependencies on:
  - `@wailsio/runtime`
  - generated Wails bindings
  - `window._wails`
  - `window.go`
- Audit with search for:
  - `wails`
  - `_wails`
  - `@wailsio/runtime`
  - `window.go`
- Exit criteria:
  - only intentional compatibility comments remain

## Phase 8: Verification Checklist

### 8.1 Frontend parity checks

- App launches into the same shell layout.
- Same HTML structure is present for:
  - titlebar
  - toolbar
  - tree pane
  - detail pane
  - overlays
- Same CSS files are used.

### 8.2 Functional parity checks

- Create bookmark file
- Open existing bookmark file
- Lazy-load tree nodes
- Search
- Add bookmark
- Add folder
- Rename folder
- Edit bookmark
- Delete one item
- Delete multiple items
- Move one item
- Move multiple items
- Import merge preview
- Import merge apply
- Open bookmark URL
- Fetch page title
- Fetch favicon
- Fetch favicons for selected nodes
- Undo
- Redo

### 8.3 Window behavior checks

- Drag titlebar
- Minimize
- Maximize
- Restore
- Close
- Persist window size across relaunch
- Frameless layout still looks correct on Linux

### 8.4 Regression checks

- Run the existing frontend tests where practical.
- Add Rust unit tests for core bookmark logic.
- Compare a sample bookmark file before and after a no-op load/save cycle.

## Suggested Work Breakdown

1. Copy frontend and make Tauri load it.
2. Replace Wails JS bindings with local Tauri adapters.
3. Replace Wails window/runtime usage with local adapters.
4. Port DTOs and domain models to Rust.
5. Port parser and serializer.
6. Port tree mutation operations.
7. Port merge logic.
8. Port undo/redo.
9. Implement Tauri commands and shared state.
10. Add dialogs, opener, and fetch support.
11. Remove Wails leftovers.
12. Run parity verification.

## Known Risk Areas

- Frameless drag and manual resize parity on Linux.
- Matching Wails-generated JSON behavior exactly for nullable or omitted fields.
- Preserving undo/redo semantics without subtly changing command history behavior.
- Matching file dialog UX and path handling across platforms.
- Keeping the frontend truly identical while removing `@wailsio/runtime`.

## Recommended Definition Of Done

- The Tauri app launches the same frontend with no scaffold UI remaining.
- The frontend uses the same HTML and CSS assets as the Wails app.
- The frontend talks only to Tauri adapters, not Wails bindings.
- The Rust backend supports the same frontend API surface as the Wails app.
- Core bookmark workflows behave the same in manual testing.
- Remaining gaps, if any, are isolated to documented platform-specific window behavior rather than app functionality.
