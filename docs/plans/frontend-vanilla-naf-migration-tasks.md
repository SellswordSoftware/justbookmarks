# Frontend Migration Task List for LLM Execution

## Purpose

This is the execution companion to `docs/plans/frontend-vanilla-naf-migration.md`.

It breaks the migration into concrete tasks that an LLM coding agent can work through in order. Each task is designed to be actionable, verifiable, and small enough to complete without inventing new scope.

## Working Rules

- Preserve all existing frontend behavior unless a task explicitly says otherwise.
- Do not change Go backend behavior unless required for compatibility with the new frontend.
- Keep the Wails bindings contract stable unless a compatibility issue forces a coordinated change.
- Prefer incremental replacement over a big-bang delete-and-rewrite.
- Do not remove the old frontend stack until parity has been demonstrated in the new one.
- Use vanilla JS with `// @ts-check` and JSDoc for new frontend code.
- Treat `docs/plans/frontend-vanilla-naf-migration.md` as the architecture source of truth.

## Definition of Done for the Overall Migration

- The app runs with a vanilla JS frontend.
- The app no longer depends on Svelte, TypeScript source files, Tailwind, DaisyUI, or Vite.
- The new frontend uses a local JS `naf-html` variant plus JSDoc typing.
- The new `daisylite` CSS system covers all current UI needs.
- The current shipped feature set still works.
- Build and dev flows still work under Wails.

## Task Format

Each task below includes:

- `Goal`: what the task accomplishes
- `Do`: concrete work to perform
- `Deliverables`: files or outputs expected
- `Verify`: what must be true before marking it done
- `Depends on`: prerequisite tasks

## Task List

### T01. Freeze the current feature contract

Goal:

Create a concrete parity checklist from the actual current app, not only from the PRD.

Do:

- Review the current frontend behavior and capture the full feature list.
- Convert the parity section from the migration plan into a standalone checklist doc.
- Group the checklist by feature area:
  - session lifecycle
  - tree rendering
  - selection
  - detail editing
  - dialogs
  - keyboard commands
  - persistence
  - batch operations
  - history
  - styling and shell behavior
- Add a place to mark manual verification results during the rewrite.

Deliverables:

- `docs/plans/frontend-parity-checklist.md`

Verify:

- The checklist covers the real current app features, including import/merge, undo/redo, bulk actions, window persistence, and custom titlebar behavior.
- The checklist is detailed enough that another agent could use it to verify parity manually.

Depends on:

- None

### T02. Decide and document the replacement frontend file layout

Goal:

Create the concrete target structure for the new frontend so implementation work lands in stable locations.

Do:

- Compare the proposed file structure in the migration plan against the actual current frontend tree.
- Adjust names only if there is a strong reason.
- Document the final target structure and naming conventions for:
  - entrypoints
  - state modules
  - feature modules
  - lib utilities
  - templates
  - styles
  - assets

Deliverables:

- Update `docs/plans/frontend-vanilla-naf-migration.md` if structure changes materially.
- Create directories under `frontend/src/` for the new architecture.

Verify:

- The structure supports native ES modules, HTML-first binding, and a no-Vite end state.
- The structure is specific enough that future tasks do not need to invent paths.

Depends on:

- T01

### T03. Enable JS + JSDoc type-checking conventions

Goal:

Set up the frontend to use JS with IDE-only type checking.

Do:

- Update `frontend/jsconfig.json` to enable `checkJs`.
- Decide whether to enable stricter JS diagnostics that remain IDE-only.
- Create a small typing convention in `frontend/src/types.js` or a nearby doc:
  - shared typedefs
  - import typedef patterns
  - return type patterns
  - `@ts-check` usage expectations
- Add `// @ts-check` to newly created JS modules.

Deliverables:

- Updated `frontend/jsconfig.json`
- `frontend/src/types.js` with shared typedefs or stubs

Verify:

- Opening the frontend in an IDE surfaces JSDoc-driven type information.
- New modules can import typedefs cleanly without TypeScript source files.

Depends on:

- T02

### T04. Port `naf-html.ts` to project-local JS

Goal:

Create the JS runtime layer the new frontend will use for reactivity and DOM binding.

Do:

- Create `frontend/src/lib/naf-html.js` from `/home/mike/code/naf/naf-html.ts`.
- Convert TypeScript syntax to plain JS + JSDoc.
- Preserve:
  - `signal`
  - `computed`
  - `effect`
  - `$`
  - `$$`
  - `$on`
  - `fx`
  - `model`
  - `list`
  - `text`
- Add only minimal app-local helpers if clearly justified:
  - cleanup collector
  - optional bind helper
  - optional delegated event helper
- Do not expand this into a larger framework.

Deliverables:

- `frontend/src/lib/naf-html.js`

Verify:

- The file is valid plain JS.
- JSDoc types are present for core APIs.
- A minimal smoke usage in local frontend code can create signals and update DOM.

Depends on:

- T03

### T05. Create the new frontend shell entrypoint

Goal:

Replace the empty app mount model with an HTML-first shell that the new modules can bind to.

Do:

- Rewrite `frontend/index.html` to contain the new shell structure.
- Include:
  - titlebar container
  - search area
  - left tree pane
  - pane resizer
  - right detail pane
  - toast container
  - confirm modal container
  - move dialog container
  - import/merge dialog container
  - keyboard shortcuts dialog container
  - any `<template>` elements needed for repeated rows/items
- Create `frontend/src/main.js` bootstrap.
- Create `frontend/src/app.js` for app wiring.
- Stop referencing `main.ts` and Svelte entrypoints from `index.html`.

Deliverables:

- Updated `frontend/index.html`
- `frontend/src/main.js`
- `frontend/src/app.js`

Verify:

- The app shell loads in the browser or Wails without Svelte.
- The DOM contains stable containers for future feature modules to bind into.

Depends on:

- T03
- T04

### T06. Build the `daisylite` CSS foundation

Goal:

Create the new semantic CSS system needed for the rewrite.

Do:

- Create the CSS folder structure proposed in the migration plan.
- Implement:
  - reset
  - tokens
  - base
  - layout
  - light theme
  - dark theme
- Implement minimum core components:
  - button
  - input
  - textarea
  - field/label/error
  - card
  - modal
  - alert
  - badge
  - toast
  - toolbar
  - menu/list item
  - spinner
- Create a single `app.css` import surface.
- Wire `index.html` or `main.js` to load the new CSS.

Deliverables:

- `frontend/src/styles/**`

Verify:

- The shell renders with readable styling without Tailwind or DaisyUI classes.
- Semantic classes exist for the components future tasks will use.

Depends on:

- T05

### T07. Port shared frontend utility modules to JS

Goal:

Replace shared TS utilities with JS equivalents used by the new frontend.

Do:

- Port `frontend/src/lib/api.ts` to `frontend/src/lib/api.js`.
- Port `frontend/src/lib/errors.ts` to `frontend/src/lib/errors.js`.
- Port `frontend/src/lib/focus.ts` to `frontend/src/lib/focus.js`.
- Port `frontend/src/lib/persistence.ts` to `frontend/src/lib/persistence.js`.
- Preserve existing behavior and exported API shapes where possible.
- Add JSDoc to exported functions and major data structures.

Deliverables:

- `frontend/src/lib/api.js`
- `frontend/src/lib/errors.js`
- `frontend/src/lib/focus.js`
- `frontend/src/lib/persistence.js`

Verify:

- New JS modules can be imported by `main.js`/`app.js`.
- Wails bridge calls still resolve correctly from JS.
- Persistence helpers still round-trip valid data.

Depends on:

- T03
- T05

### T08. Define shared state module boundaries

Goal:

Create the state layer architecture before porting interaction-heavy features.

Do:

- Create state modules under `frontend/src/lib/state/`.
- Define the boundaries between:
  - app state
  - tree state
  - search state
  - move dialog state
  - UI state
- Keep state public APIs explicit:
  - raw signals
  - computed helpers
  - actions
  - selectors
- Avoid embedding major business logic inside DOM-binding modules.

Deliverables:

- `frontend/src/lib/state/*.js` module stubs with documented exports

Verify:

- It is clear which module owns selection, expanded nodes, toasts, dialogs, query, and session state.
- Future feature tasks can bind to these modules without reshaping architecture again.

Depends on:

- T07

### T09. Port search state to JS

Goal:

Get a simple state domain working end-to-end with `naf-html`.

Do:

- Port `searchStore.svelte.ts` to `search-state.js`.
- Use signals/computed for:
  - query
  - flat index
  - derived results
- Preserve current search semantics.

Deliverables:

- `frontend/src/lib/state/search-state.js`

Verify:

- A test binding can set the query and derive filtered results.
- Empty query behavior is preserved.

Depends on:

- T08

### T10. Port UI state to JS

Goal:

Create the signal-based toast and confirm-modal state domain.

Do:

- Port `uiStore.svelte.ts` to `ui-state.js`.
- Preserve:
  - toast queue
  - toast expiry
  - confirm modal state
  - async confirm handling
- Keep APIs narrow and explicit.

Deliverables:

- `frontend/src/lib/state/ui-state.js`

Verify:

- Toasts can be added and removed.
- Confirm modal state can be opened, confirmed, and closed.

Depends on:

- T08

### T11. Port move dialog state to JS

Goal:

Create the move-target state needed for single and bulk moves.

Do:

- Port `moveDialogStore.svelte.ts` to `move-dialog-state.js`.
- Preserve folder-target collection semantics.
- Preserve excluded-folder logic for moving folders.

Deliverables:

- `frontend/src/lib/state/move-dialog-state.js`

Verify:

- Given tree data, the module can derive valid move targets.
- Excluded descendants are not offered for folder moves.

Depends on:

- T08

### T12. Port tree state to JS

Goal:

Move the most critical frontend behavior into a signal-based JS state module.

Do:

- Port the tree store into `tree-state.js`.
- Preserve:
  - tree normalization
  - node lookup
  - parent lookup
  - sibling lookup
  - expand/collapse
  - selection
  - primary selection
  - multi-select constraints
  - range selection
  - visible node computation
  - persistent state restore/save helpers
  - refresh/load behavior
- Keep public APIs close to the existing store shape where useful.

Deliverables:

- `frontend/src/lib/state/tree-state.js`

Verify:

- The module can load tree data from Wails bindings.
- Selection logic behaves like the current app for single, range, and multi-select cases.
- Visible node derivation works for keyboard navigation.

Depends on:

- T07
- T08
- T09

### T13. Wire session bootstrap and file-open lifecycle

Goal:

Make the shell capable of starting a real session with the backend.

Do:

- Implement bootstrap flow in `app.js` and related modules:
  - read persisted UI state
  - load CLI-provided file path
  - fall back to last opened file
  - sync runtime window state if available
  - handle no-Wails environments gracefully
- Implement open file and create file actions.
- Ensure `currentFilePath` equivalent state exists.

Deliverables:

- `frontend/src/app.js`
- `frontend/src/lib/state/app-state.js` or similar session owner

Verify:

- The app can start and load a file through the new JS frontend.
- The app can create a new bookmark file through the new JS frontend.

Depends on:

- T07
- T10
- T12

### T14. Implement titlebar and window controls

Goal:

Restore frameless window behavior in the new frontend shell.

Do:

- Create a `titlebar.js` feature module.
- Port:
  - minimize
  - maximize/toggle maximize
  - close
  - double-click maximize behavior
  - runtime availability checks
- Recreate required titlebar DOM and styles.

Deliverables:

- `frontend/src/lib/features/titlebar.js`

Verify:

- Titlebar buttons work in Wails.
- Double-click behavior still toggles maximize.

Depends on:

- T05
- T06
- T13

### T15. Implement pane layout and resize persistence

Goal:

Restore the resizable split-pane app layout.

Do:

- Implement pane sizing logic in a shell/layout module.
- Port:
  - left-pane width state
  - drag-to-resize
  - width clamping
  - persistence of width
- Ensure the shell works at minimum supported widths.

Deliverables:

- `frontend/src/lib/features/layout.js` or equivalent

Verify:

- Left pane can be resized.
- Width persists across reloads.

Depends on:

- T06
- T07
- T13

### T16. Implement search bar UI binding

Goal:

Create the search surface for tree mode and search mode.

Do:

- Build `search-bar.js`.
- Bind the input to search state.
- Support:
  - typing query
  - clearing query
  - exposing input focus for shortcuts
- Add semantic `daisylite` classes rather than Tailwind classes.

Deliverables:

- `frontend/src/lib/features/search-bar.js`

Verify:

- Query state updates as the user types.
- Clearing the query resets the state.

Depends on:

- T06
- T09
- T13

### T17. Implement tree rendering with templates and `list(...)`

Goal:

Render the bookmark tree in the new frontend.

Do:

- Create tree row templates in HTML.
- Implement `bookmark-tree.js` and `tree-node.js`.
- Render the visible tree entries from tree state.
- Show:
  - folder chevrons
  - folder icon/open state
  - bookmark icon/fallback
  - selection visuals
  - child counts where appropriate
- Preserve search-mode rendering behavior if using a separate result template.

Deliverables:

- Tree templates in `frontend/index.html`
- `frontend/src/lib/features/bookmark-tree.js`
- `frontend/src/lib/features/tree-node.js`

Verify:

- Tree data renders correctly.
- Expand/collapse and selected styling update from state.

Depends on:

- T06
- T12
- T16

### T18. Restore tree keyboard navigation

Goal:

Bring back keyboard-first navigation for the tree and search results.

Do:

- Port key handling for:
  - Up/Down
  - Left/Right
  - Home/End
  - PageUp/PageDown
  - Enter
  - Space
- Support tree mode and search mode.
- Preserve range-extension behavior with Shift where currently supported.

Deliverables:

- Updated `bookmark-tree.js` and related focus helpers

Verify:

- Keyboard navigation moves selection as in the current app.
- Search result navigation works independently from normal tree mode.

Depends on:

- T17

### T19. Restore tree mouse selection semantics

Goal:

Match the current click, Ctrl/Cmd-click, and Shift-click selection rules.

Do:

- Port selection behavior for:
  - single click
  - Ctrl/Cmd-click toggle
  - Shift-click range select
- Preserve sibling-group constraints and warning surface behavior.
- Surface invalid multi-select attempts via toasts or equivalent warnings.

Deliverables:

- Updated `tree-node.js`

Verify:

- Single selection works.
- Valid sibling multi-select works.
- Invalid multi-select shows feedback and does not corrupt state.

Depends on:

- T10
- T12
- T17

### T20. Implement detail panel state switching

Goal:

Create the right pane controller for no-selection, folder, bookmark, and bulk-selection views.

Do:

- Create `detail-panel.js`.
- Bind it to tree state and selection state.
- Show the correct pane for:
  - no selection
  - single folder
  - single bookmark
  - multi-selection
- Keep a stable DOM structure where practical.

Deliverables:

- `frontend/src/lib/features/detail-panel.js`

Verify:

- Changing selection changes the right pane correctly.

Depends on:

- T12
- T17

### T21. Port add-folder flow

Goal:

Restore root and in-folder folder creation.

Do:

- Implement `add-folder-form.js`.
- Implement root add-folder trigger and folder-detail add-folder trigger.
- Preserve validation and close behavior.
- Refresh tree state after successful creation.

Deliverables:

- `frontend/src/lib/features/add-folder-form.js`

Verify:

- A folder can be created at root or inside a selected folder.
- Validation errors show correctly.

Depends on:

- T10
- T12
- T20

### T22. Port folder detail and rename flow

Goal:

Restore the folder detail panel behavior.

Do:

- Implement `folder-detail.js`.
- Show:
  - editable name
  - child count
  - add bookmark action
  - add folder action
  - rename behavior
  - delete behavior
- Preserve keyboard shortcuts for editing/renaming where currently supported.

Deliverables:

- `frontend/src/lib/features/folder-detail.js`

Verify:

- Selecting a folder shows the correct detail view.
- Renaming and delete actions work.

Depends on:

- T20
- T21

### T23. Port add-bookmark flow

Goal:

Restore bookmark creation with auto title and favicon behavior.

Do:

- Implement `add-bookmark-form.js`.
- Preserve:
  - URL input
  - title input
  - icon state
  - 800ms debounce
  - fetch page title
  - fetch favicon
  - stale request invalidation
  - non-destructive auto-fill logic
- Support root and in-folder creation triggers.

Deliverables:

- `frontend/src/lib/features/add-bookmark-form.js`

Verify:

- A bookmark can be added.
- Auto-fill behavior matches the current app semantics.

Depends on:

- T07
- T10
- T12
- T20

### T24. Port bookmark detail and edit flow

Goal:

Restore bookmark inspection, editing, favicon fetch, and open-in-browser behavior.

Do:

- Implement `bookmark-detail.js`.
- Preserve:
  - edit mode
  - title/url/meta editing
  - favicon display and manual fetch
  - auto title/favicon fill on URL edits
  - open in browser
  - delete
  - move action
- Ensure tree refresh behavior matches current expectations after writes.

Deliverables:

- `frontend/src/lib/features/bookmark-detail.js`

Verify:

- Selecting a bookmark shows the correct detail view.
- Saving edits works.
- Open-in-browser works.
- Manual favicon fetch works.

Depends on:

- T20
- T23

### T25. Implement toast container UI

Goal:

Render the UI-state toast queue in the new shell.

Do:

- Create `toast-container.js`.
- Render toasts from UI state.
- Style with `daisylite` alert/toast classes.
- Preserve toast positioning and type-based visuals.

Deliverables:

- `frontend/src/lib/features/toast-container.js`

Verify:

- Toasts render, expire, and disappear correctly.

Depends on:

- T06
- T10

### T26. Implement confirm modal UI

Goal:

Restore the shared confirmation dialog.

Do:

- Create `confirm-modal.js`.
- Render modal from UI state.
- Preserve:
  - open/close behavior
  - confirm callback behavior
  - focus trap
  - Escape handling
  - backdrop click behavior if currently supported

Deliverables:

- `frontend/src/lib/features/confirm-modal.js`

Verify:

- Delete confirmations and other confirms work.
- Focus remains trapped while open.

Depends on:

- T06
- T07
- T10

### T27. Implement bulk-selection detail pane

Goal:

Restore batch operations for multi-selected items.

Do:

- Implement `bulk-selection-detail.js`.
- Show selected count and selection context.
- Support:
  - bulk delete
  - bulk favicon refresh
  - bulk title refresh
  - bulk move trigger
- Use current backend APIs where available.

Deliverables:

- `frontend/src/lib/features/bulk-selection-detail.js`

Verify:

- Multi-selecting compatible items shows the bulk pane.
- Batch actions run against all selected nodes.

Depends on:

- T11
- T20
- T25
- T26

### T28. Implement move dialog UI and action flow

Goal:

Restore single-item and bulk move workflows.

Do:

- Create `move-dialog.js`.
- Bind the dialog to move-dialog state.
- Support:
  - selecting a target folder
  - keyboard navigation within the dialog
  - confirm move
  - cancel
  - closing on Escape
- Route single vs bulk moves to the correct backend calls.

Deliverables:

- `frontend/src/lib/features/move-dialog.js`

Verify:

- Single move works.
- Bulk move works.
- Invalid folder targets are not offered.

Depends on:

- T11
- T12
- T26
- T27

### T29. Restore drag-and-drop reorder and move

Goal:

Bring back direct-manipulation tree drag-and-drop.

Do:

- Port DnD behavior into tree row bindings.
- Preserve:
  - drag state
  - drop target detection
  - before/after/inside semantics
  - folder drop handling
  - root-level limitations if they still exist
  - feedback on invalid moves
- Ensure state refreshes after successful backend move operations.

Deliverables:

- Updated `tree-node.js`

Verify:

- Bookmarks and folders can be moved/reordered as they are today.
- Invalid move attempts fail safely.

Depends on:

- T17
- T19
- T25

### T30. Implement keyboard shortcuts help dialog

Goal:

Restore the keyboard shortcut reference modal.

Do:

- Create `keyboard-shortcuts-dialog.js`.
- Port the current grouped shortcut data.
- Render the modal from app/UI state.
- Preserve focus trapping and Escape-to-close behavior.

Deliverables:

- `frontend/src/lib/features/keyboard-shortcuts-dialog.js`

Verify:

- The dialog opens and closes correctly.
- The displayed shortcuts match current app behavior.

Depends on:

- T26

### T31. Implement import/merge dialog

Goal:

Restore import/merge preview and apply behavior.

Do:

- Create `import-merge-dialog.js`.
- Port:
  - open import file picker
  - preview loading
  - preview display
  - “no new changes” behavior
  - apply merge
  - error states
  - close/reset behavior
- Preserve integration with tree refresh and toast messaging.

Deliverables:

- `frontend/src/lib/features/import-merge-dialog.js`

Verify:

- Import preview works.
- Applying a merge updates the tree and shows the correct success feedback.

Depends on:

- T10
- T12
- T25
- T26

### T32. Implement global shortcut routing

Goal:

Restore top-level keyboard commands across the app.

Do:

- Create `global-shortcuts.js`.
- Port commands for:
  - open file
  - create file
  - import/merge
  - search focus
  - focus-zone cycling
  - add bookmark
  - add folder
  - edit
  - rename
  - open bookmark
  - move
  - delete
  - fetch favicons
  - refresh titles
  - undo
  - redo
  - shortcuts help
- Preserve editable-target checks so shortcuts do not fire incorrectly while typing.

Deliverables:

- `frontend/src/lib/features/global-shortcuts.js`

Verify:

- Global shortcuts work as documented in the current app.
- Shortcuts do not interfere with normal text entry.

Depends on:

- T13
- T15
- T16
- T18
- T22
- T24
- T27
- T28
- T30
- T31

### T33. Restore focus-zone management

Goal:

Preserve keyboard flow between search, tree, detail, and dialogs.

Do:

- Port focus-zone helpers and shell-level focus routing.
- Preserve:
  - focus search
  - focus tree
  - focus detail
  - cycle focus zones
  - focus after shortcut-driven open/edit actions

Deliverables:

- Focus logic in `app.js`, layout, or dedicated focus coordinator

Verify:

- F6 cycle behavior works.
- Shortcut-driven actions place focus in the intended field.

Depends on:

- T16
- T18
- T20
- T32

### T34. Restore undo/redo flow

Goal:

Bring back history actions and their feedback.

Do:

- Port the `GetHistoryState`, `Undo`, and `Redo` integration.
- Make the global shortcut layer route history actions correctly.
- Refresh tree state after history operations.
- Surface failures or empty-history conditions appropriately.

Deliverables:

- History integration in `app.js` and/or `global-shortcuts.js`

Verify:

- Undo works.
- Redo works.
- Tree view updates after each action.

Depends on:

- T12
- T32

### T35. Restore window-size persistence

Goal:

Preserve the current window geometry persistence behavior.

Do:

- Port:
  - load persisted size at startup
  - save size when the window is normal
  - debounce/schedule persistence
  - runtime availability guards
- Keep best-effort behavior on failures.

Deliverables:

- Window persistence logic in app/session/titlebar modules

Verify:

- Window size is restored between launches.

Depends on:

- T07
- T13
- T14

### T36. Create the no-Vite build pipeline

Goal:

Move the frontend to a simple build system compatible with the new architecture.

Do:

- Replace Vite-based build/dev scripts with minimal Node scripts or equivalent.
- Implement a build script that copies:
  - `index.html`
  - JS modules
  - CSS
  - templates if separate
  - assets
  - required Wails-generated frontend bindings
- Ensure output lands in `frontend/dist`.
- Decide whether a dev static server is still needed and implement it only if necessary.

Deliverables:

- `frontend/scripts/build-frontend.mjs`
- optional `frontend/scripts/dev-frontend.mjs`
- updated `frontend/package.json`
- updated `wails.json` if needed

Verify:

- `frontend/dist` is generated correctly.
- Wails can embed and serve the new frontend.

Depends on:

- T05
- T06
- T07

### T37. Remove old Svelte/TS/Tailwind/DaisyUI/Vite stack

Goal:

Delete the replaced stack only after the new frontend is functional.

Do:

- Remove:
  - Svelte component files
  - `main.ts`
  - `App.svelte`
  - store `.svelte.ts` files
  - Svelte config
  - TS frontend configs no longer needed
  - Vite config
  - Tailwind config/dependencies
  - DaisyUI dependency
- Keep only what is still required for Wails-generated bindings or runtime integration.
- Clean `package.json` and lockfile.

Deliverables:

- Simplified frontend tree
- updated dependency manifests

Verify:

- No application code imports Svelte, Vite, Tailwind, DaisyUI, or TS source.
- The app still builds and runs.

Depends on:

- T36
- T38

### T38. Run parity verification against the checklist

Goal:

Prove the migration preserved behavior.

Do:

- Use `docs/plans/frontend-parity-checklist.md` as the test script.
- Manually verify each item.
- Record pass/fail notes.
- Fix any parity regressions before considering the rewrite complete.

Deliverables:

- Updated `docs/plans/frontend-parity-checklist.md` with verification notes

Verify:

- Every parity item is either passed or has a tracked follow-up.
- No known regressions remain in core app flows.

Depends on:

- T13 through T37

### T39. Update developer documentation

Goal:

Make the repo understandable after the frontend pivot.

Do:

- Update `README.md` development/build sections.
- Document the new frontend architecture briefly:
  - no Svelte
  - no TypeScript source
  - no Vite
  - JS + JSDoc conventions
  - `naf-html` runtime location
  - `daisylite` CSS structure
- Update any docs that still describe the old stack.

Deliverables:

- Updated `README.md`
- any relevant docs updates

Verify:

- A fresh contributor reading the docs would not expect Svelte/Vite/TS/Tailwind.

Depends on:

- T36
- T37
- T38

## Suggested Execution Batches

If an LLM agent should work in batches rather than single tasks, use this order:

### Batch A. Foundations

- T01
- T02
- T03
- T04
- T05
- T06
- T07
- T08

### Batch B. State and shell

- T09
- T10
- T11
- T12
- T13
- T14
- T15
- T16

### Batch C. Core interaction surface

- T17
- T18
- T19
- T20
- T21
- T22
- T23
- T24

### Batch D. Workflows and dialogs

- T25
- T26
- T27
- T28
- T29
- T30
- T31

### Batch E. Keyboard, history, and persistence polish

- T32
- T33
- T34
- T35

### Batch F. Cutover and verification

- T36
- T37
- T38
- T39

## Notes for the Agent

- The hardest migration risk is tree-state parity. Do not rush T12, T17, T18, T19, or T29.
- Prefer ports that preserve behavior first, then clean up naming or structure after verification.
- When uncertain about behavior, consult the current Svelte frontend rather than the original PRD.
- Do not treat styling as separate from behavior. The desktop shell, focus states, and dialog behavior are part of the product.
