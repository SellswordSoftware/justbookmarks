# Tauri Adapter Seam Map

Goal: define the smallest file-by-file map needed to replace the Wails integration layer while keeping the frontend as unchanged as possible.

Scope: this map is intentionally narrow. It covers only:

- frontend binding replacement
- frontend window/runtime replacement
- immediate Tauri-side files that those adapters depend on

It does not attempt to map every Rust domain file.

## Guiding Principle

Do not rewrite feature modules across the app. Keep the rest of the frontend calling the same `api.js` and app-state APIs, then change only the modules at the seam.

## Target Layout In `/home/mike/code/tauritest`

Recommended frontend root:

- `/home/mike/code/tauritest/frontend`

Recommended Rust root remains:

- `/home/mike/code/tauritest/src-tauri`

## Frontend File Map

### 1. Copy these files unchanged first

From Wails app:

- `frontend/index.html`
- `frontend/src/**`
- `frontend/src/assets/**`
- `frontend/src/styles/**`
- `frontend/tests/**`
- `frontend/scripts/**`
- `frontend/test-data/**`
- `frontend/vite.config.js`
- `frontend/jsconfig.json`
- `frontend/package.json`

Into Tauri app:

- `/home/mike/code/tauritest/frontend/index.html`
- `/home/mike/code/tauritest/frontend/src/**`
- `/home/mike/code/tauritest/frontend/src/assets/**`
- `/home/mike/code/tauritest/frontend/src/styles/**`
- `/home/mike/code/tauritest/frontend/tests/**`
- `/home/mike/code/tauritest/frontend/scripts/**`
- `/home/mike/code/tauritest/frontend/test-data/**`
- `/home/mike/code/tauritest/frontend/vite.config.js`
- `/home/mike/code/tauritest/frontend/jsconfig.json`
- `/home/mike/code/tauritest/frontend/package.json`

Purpose:

- establish the frontend baseline before editing the seam

### 2. Delete or ignore these Wails-specific copied directories

Do not use these as runtime dependencies in the Tauri app:

- `/home/mike/code/tauritest/frontend/bindings`
- `/home/mike/code/tauritest/frontend/wailsjs`

Purpose:

- avoid accidentally leaving generated Wails bindings in the runtime path

### 3. Replace this file in-place

Target file:

- `/home/mike/code/tauritest/frontend/src/shared/api/api.js`

Current role:

- stable frontend-facing API surface
- imports generated Wails bindings

Required change:

- keep exported functions unchanged
- replace Wails-generated imports with imports from a new local adapter module

The rest of the app should continue importing only this file.

### 4. Add one new backend binding adapter file

Create:

- `/home/mike/code/tauritest/frontend/src/shared/api/tauri-api-bindings.js`

Responsibility:

- own all `invoke(...)` calls to Rust commands
- expose one JS function per current Wails command
- preserve the same argument ordering expected by `api.js`

Recommended exports:

- `GetFilePath`
- `OpenFilePicker`
- `OpenImportFilePicker`
- `CreateBookmarkFile`
- `LoadBookmarkFile`
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

Purpose:

- concentrate all JS-to-Rust command wiring in one file

### 5. Add one new window/runtime adapter file

Create:

- `/home/mike/code/tauritest/frontend/src/shared/runtime/window-host.js`

Responsibility:

- own all Tauri window and app shell interactions currently coming from `@wailsio/runtime`

Recommended exports:

- `hasNativeWindowHost`
- `minimiseWindow`
- `toggleMaximiseWindow`
- `isMaximised`
- `isMinimised`
- `getWindowSize`
- `setWindowSize`
- `closeApplication`
- `startWindowDrag`

Optional exports if needed:

- `beginWindowResize`
- `isLinuxDesktop`

Purpose:

- prevent Tauri-specific window logic from leaking into multiple components

### 6. Replace this titlebar file in-place

Target file:

- `/home/mike/code/tauritest/frontend/src/components/titlebar/titlebar.js`

Current role:

- imports `Application` and `Window` from `@wailsio/runtime`
- handles minimize, maximize, close, and titlebar double-click behavior

Required change:

- replace `@wailsio/runtime` import with `window-host.js`
- keep markup and component structure unchanged where possible
- preserve existing button ids, classes, and behavior

Purpose:

- retain identical UI while swapping native window controls underneath

### 7. Replace this app-state file in-place

Target file:

- `/home/mike/code/tauritest/frontend/src/shared/state/app-state.js`

Current role:

- determines whether native runtime exists
- restores and persists window size
- checks maximized/minimized state

Required change:

- replace `Window` import from `@wailsio/runtime`
- replace `hasWailsRuntime()` with a host-neutral check such as `hasNativeWindowHost()`
- keep state signals, selectors, and actions stable unless absolutely necessary

Purpose:

- preserve the app-state contract used by the rest of the frontend

### 8. Replace this resize integration file in-place

Target file:

- `/home/mike/code/tauritest/frontend/src/app/window-resize.js`

Current role:

- Linux-only Wails resize handle integration using `window._wails.invoke("wails:resize:*")`

Required change:

- either route to a Tauri resize method through `window-host.js`
- or reduce this module to a no-op if acceptable parity is not immediately practical

Decision rule:

- if Tauri frameless resize can be implemented cleanly, keep the feature
- if not, isolate the gap here rather than spreading conditionals across the app

Purpose:

- localize the hardest window-parity risk to one file

### 9. Update this HTML file minimally

Target file:

- `/home/mike/code/tauritest/frontend/index.html`

Current role:

- contains titlebar drag-region attributes that are Wails-specific

Required change:

- preserve the markup structure
- change only the attributes or hooks required for Tauri drag regions
- do not redesign or reshuffle the DOM

Likely touchpoints:

- `data-wails-drag`
- `data-wails-no-drag`
- inline draggable style hook

Purpose:

- keep the shell visually identical while enabling Tauri-native dragging

### 10. Update this frontend package manifest

Target file:

- `/home/mike/code/tauritest/frontend/package.json`

Required change:

- remove `@wailsio/runtime`
- add Tauri JS packages if using package-based imports instead of global Tauri access
- preserve the Vite and test scripts from the Wails frontend

Purpose:

- make the frontend self-sufficient inside the Tauri repo

## Tauri File Map

### 11. Update Tauri config

Target file:

- `/home/mike/code/tauritest/src-tauri/tauri.conf.json`

Required change:

- point `frontendDist` at the copied frontend build output
- add `devUrl` or pre-dev command wiring for the frontend dev server
- set window geometry and frameless config to match Wails
- update product name and identifier

Purpose:

- connect the new frontend root to the Tauri shell

### 12. Replace the scaffold command registration

Target file:

- `/home/mike/code/tauritest/src-tauri/src/lib.rs`

Current role:

- registers only the `greet` command

Required change:

- remove `greet`
- register the Wails-equivalent command set used by `tauri-api-bindings.js`
- initialize shared app state
- keep plugin registration here

Purpose:

- make this the sole Rust-side command wiring entrypoint

### 13. Keep `main.rs` minimal

Target file:

- `/home/mike/code/tauritest/src-tauri/src/main.rs`

Required change:

- likely no major structural changes
- keep platform env setup if it remains useful
- continue delegating to `lib.rs`

Purpose:

- avoid mixing app bootstrap with command implementation

### 14. Add one Rust commands module

Create:

- `/home/mike/code/tauritest/src-tauri/src/commands/mod.rs`

Responsibility:

- expose the command functions called by `invoke(...)`
- separate command wiring from domain logic

Recommended grouping inside this module:

- app/file dialog commands
- bookmark handler commands
- history commands
- utility/network commands

Purpose:

- give the JS adapter a clear, stable Rust entry surface

### 15. Add one Rust state module

Create:

- `/home/mike/code/tauritest/src-tauri/src/state.rs`

Responsibility:

- hold shared mutable app state
- current file path
- bookmark tree
- undo stack
- redo stack

Purpose:

- provide a single state object used by all Tauri commands

### 16. Add one Rust DTO module

Create:

- `/home/mike/code/tauritest/src-tauri/src/dto.rs`

Responsibility:

- define serde-serializable types matching the Wails JSON contract

Purpose:

- keep payload shape control out of command functions

## Exact Edit Sequence

1. Copy Wails frontend into `/home/mike/code/tauritest/frontend`.
2. Update `/home/mike/code/tauritest/src-tauri/tauri.conf.json` to point at that frontend.
3. Replace `/home/mike/code/tauritest/frontend/src/shared/api/api.js` imports.
4. Add `/home/mike/code/tauritest/frontend/src/shared/api/tauri-api-bindings.js`.
5. Add `/home/mike/code/tauritest/frontend/src/shared/runtime/window-host.js`.
6. Update `/home/mike/code/tauritest/frontend/src/components/titlebar/titlebar.js`.
7. Update `/home/mike/code/tauritest/frontend/src/shared/state/app-state.js`.
8. Update `/home/mike/code/tauritest/frontend/src/app/window-resize.js`.
9. Make the smallest possible drag-region edits in `/home/mike/code/tauritest/frontend/index.html`.
10. Replace scaffold command wiring in `/home/mike/code/tauritest/src-tauri/src/lib.rs`.
11. Add `/home/mike/code/tauritest/src-tauri/src/commands/mod.rs`.
12. Add `/home/mike/code/tauritest/src-tauri/src/state.rs`.
13. Add `/home/mike/code/tauritest/src-tauri/src/dto.rs`.

## Files That Should Stay Stable

These should ideally not require semantic changes during the seam swap:

- most files under `/home/mike/code/tauritest/frontend/src/features/**`
- most files under `/home/mike/code/tauritest/frontend/src/pages/**`
- most files under `/home/mike/code/tauritest/frontend/src/components/**` except titlebar
- CSS files under `/home/mike/code/tauritest/frontend/src/styles/**`

If these files need significant edits, that is usually a sign the adapter seam is too thin or placed incorrectly.

## Success Criteria For The Narrow Map

- The copied frontend builds in Tauri.
- No production frontend file imports Wails-generated bindings.
- No production frontend file imports `@wailsio/runtime`.
- Native window actions are routed through one adapter file.
- Backend calls are routed through one adapter file.
- The rest of the frontend remains mostly unchanged.
