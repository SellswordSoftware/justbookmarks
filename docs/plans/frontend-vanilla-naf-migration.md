# Frontend Migration Plan: Svelte/TypeScript to Vanilla JS + NAF-HTML + Daisylite

## Reader and Goal

This plan is for the maintainer implementing the frontend pivot.

After reading it, the maintainer should be able to replace the current Svelte/TypeScript/Tailwind/DaisyUI frontend with a vanilla JavaScript frontend that:

- uses strict JS with JSDoc for editor-enforced type information
- uses a JS variant of `naf-html` for signals, effects, bindings, and keyed lists
- uses a home-grown DaisyUI-like style system
- preserves all existing product behavior, including the features added after `prd.md`

## What Exists Today

The backend and Wails integration are already the durable part of the app. The real migration target is the frontend layer.

Current frontend characteristics:

- Svelte 5 runes
- TypeScript everywhere in the frontend
- Tailwind v4 + DaisyUI classes
- Vite-based dev/build pipeline
- `App.svelte` as a large orchestration layer with modal management, keyboard shortcuts, pane resizing, persistence, and Wails runtime window controls
- store modules for tree state, search state, move dialog state, and toast/confirm state

The app is also beyond the original `prd.md`. The current shipped feature set includes:

- open existing bookmark file
- create new bookmark file
- restore last opened file
- immediate autosave through backend mutations
- tree expand/collapse
- selection, multi-selection, range selection, sibling-group constraints
- keyboard-first tree navigation
- search mode with result navigation
- bookmark add/edit/delete
- folder add/rename/delete
- drag-and-drop single-node reorder and move
- move dialog for single or bulk move
- bulk delete
- bulk title refresh
- bulk favicon refresh
- import/merge preview and apply
- undo/redo
- toast notifications
- confirm modal
- keyboard shortcuts modal
- persisted left-pane width
- persisted per-file tree expansion/selection
- persisted window size
- custom frameless titlebar controls
- focus-zone management between search, tree, detail, and dialogs

The migration has to preserve this actual behavior, not just the earlier PRD.

## Recommended Target Architecture

### 1. Frontend stack

Replace the current frontend with:

- browser-native ES modules
- plain HTML entrypoints
- plain JS modules with `// @ts-check`
- JSDoc typedefs and return types
- a local `naf-html.js` runtime adapted from `/home/mike/code/naf/naf-html.ts`
- a local CSS design system named `daisylite`

Recommended principle: remove framework magic, keep explicit state and DOM ownership.

### 2. Type strategy

Use strict editor-checked JavaScript, not compiled TypeScript.

Recommended setup:

- enable `checkJs: true` in `frontend/jsconfig.json`
- use `// @ts-check` at the top of all non-trivial JS modules
- define shared typedefs in one or two JSDoc-focused modules such as `src/types.js`
- use `@typedef`, `@param`, `@returns`, and `@import` heavily for state contracts and backend payloads
- keep type enforcement IDE-only; do not block builds on type checking unless you later decide to add that intentionally

This matches the goal of staying in JS while still keeping the codebase navigable and safe to edit.

### 3. NAF layer

Create a project-local JS variant of `naf-html` rather than importing the TypeScript file directly.

Recommended deliverable:

- `frontend/src/lib/naf-html.js`

Keep the current reactive core and DOM helpers:

- `signal`
- `computed`
- `effect`
- `fx`
- `model`
- `$`, `$$`, `$on`
- `list`
- `text`

Adapt them to JS + JSDoc.

Small extensions worth adding during the port:

- a tiny cleanup collector helper for components that mount many effects
- a delegated event helper if repeated event binding becomes noisy
- optional `bind(root, setup)` sugar if it improves component mounting consistency

Do not turn this into a new framework. The point is to keep the library tiny and predictable.

### 4. UI composition model

Use HTML-first component islands rather than string-template rendering.

Recommended pattern:

- `index.html` defines the app shell, shared dialogs, templates, and stable layout containers
- each feature module binds behavior into existing DOM
- repeated structures use `<template>` plus `list(...)`
- detail panes and dialogs are shown/hidden by state and updated via signals/effects

This matches how `naf-html` wants to work and avoids rebuilding a component compiler.

### 5. Styling model

Build a small semantic CSS system inspired by DaisyUI, not a utility clone.

Recommended structure:

- `styles/reset.css`
- `styles/tokens.css`
- `styles/themes/light.css`
- `styles/themes/dark.css`
- `styles/base.css`
- `styles/layout.css`
- `styles/components/button.css`
- `styles/components/form.css`
- `styles/components/card.css`
- `styles/components/modal.css`
- `styles/components/tree.css`
- `styles/components/toast.css`
- `styles/components/badge.css`
- `styles/components/alert.css`
- `styles/components/menu.css`
- `styles/components/toolbar.css`
- `styles/app.css`

Recommended API shape:

- semantic tokens such as `--color-primary`, `--color-base-100`, `--radius-field`
- semantic component classes such as `.btn`, `.btn-primary`, `.input`, `.card`, `.modal`, `.alert`
- a small layout helper set such as `.stack`, `.cluster`, `.split`, `.surface`

Avoid recreating Tailwind utility sprawl. The maintenance cost is not worth it for this app.

## Suggested File Layout

```text
frontend/
  index.html
  jsconfig.json
  package.json
  scripts/
    build-frontend.mjs
    dev-frontend.mjs
  src/
    main.js
    app.js
    types.js
    templates/
      tree-node.html
      search-result.html
      toast.html
    lib/
      naf-html.js
      api.js
      errors.js
      focus.js
      persistence.js
      dom.js
      state/
        app-state.js
        tree-state.js
        search-state.js
        move-dialog-state.js
        ui-state.js
      features/
        titlebar.js
        search-bar.js
        bookmark-tree.js
        tree-node.js
        detail-panel.js
        bookmark-detail.js
        folder-detail.js
        bulk-selection-detail.js
        add-bookmark-form.js
        add-folder-form.js
        confirm-modal.js
        toast-container.js
        move-dialog.js
        import-merge-dialog.js
        keyboard-shortcuts-dialog.js
        global-shortcuts.js
    styles/
      ...
```

## Build and Dev Recommendation

Because the goal is to move away from Vite, the clean target is a no-transpile frontend.

Recommended end state:

- `frontend/src/**/*.js` ships as native ES modules
- CSS ships as normal CSS
- a tiny build script copies `index.html`, `src`, `styles`, assets, and generated Wails bindings into `frontend/dist`
- Wails embeds `frontend/dist` exactly as it does today

That gives you:

- no TS compile step
- no Svelte compile step
- no Vite dependency
- no bundler-specific component model

The one thing to validate early is Wails dev ergonomics. If live development becomes awkward without a simple dev server, use a temporary minimal Node static server script during the migration. That is acceptable as a migration aid as long as Vite is removed from the final architecture.

## Migration Strategy

Do this in two tracks: infrastructure first, then feature port in thin vertical slices.

### Phase 0. Lock down feature parity

Before changing the frontend, write a migration checklist from the current app, not from `prd.md`.

Required checklist groups:

- shell and session lifecycle
- tree rendering and selection model
- detail editing flows
- dialog workflows
- keyboard workflows
- persistence behavior
- batch operations
- import/merge
- history
- styling primitives

This checklist should be the acceptance contract for the rewrite.

### Phase 1. Install the new frontend skeleton

Deliverables:

- plain `index.html` app shell
- `main.js` bootstrap
- JS `naf-html` variant
- JSDoc type module
- `daisylite` token/base/component CSS skeleton
- no Svelte imports
- no TypeScript source in the new path

At the end of this phase, the app can load a static shell in Wails and show placeholder panels and dialogs.

### Phase 2. Port shared infrastructure

Port these first because nearly every feature depends on them:

- `api.ts` to `api.js`
- `errors.ts` to `errors.js`
- `focus.ts` to `focus.js`
- `persistence.ts` to `persistence.js`
- `uiStore` to signal-based UI state
- `searchStore` to signal-based search state
- `moveDialogStore` to signal-based move-dialog state
- core tree store behavior to signal-based tree state

Recommended state shape:

- one state module per domain
- exported signals plus small action functions
- derived/computed helpers for visible nodes, selection info, and search results

Do not scatter state into component modules. The Svelte version already showed where central coordination is required.

### Phase 3. Port app shell orchestration

Port `App.svelte` next, but split it intentionally.

Recommended modules:

- `app.js` for bootstrap and wiring
- `titlebar.js` for maximize/minimize/close logic
- `global-shortcuts.js` for application-wide key handling
- `layout.js` or `app-shell.js` for pane resizing and focus-zone coordination
- `session.js` for file open/create/load/reopen flow

The current `App.svelte` is the biggest coupling point. If you port it as one giant JS file, you will keep the same maintenance problem without the compiler help.

### Phase 4. Port visible features in this order

Recommended order:

1. Search bar
2. Tree rendering
3. Selection and keyboard navigation
4. Detail panel switching
5. Folder detail and add-folder flow
6. Bookmark detail and add-bookmark flow
7. Toasts and confirm modal
8. Move dialog
9. Drag-and-drop
10. Keyboard shortcuts dialog
11. Import/merge dialog
12. Undo/redo and batch commands
13. Window and tree persistence polish

This order front-loads the highest-risk interaction model: tree state and selection semantics.

### Phase 5. Remove old stack

Only after feature parity is proven:

- delete Svelte component files
- delete TypeScript frontend sources
- remove Svelte config
- remove Vite config
- remove Tailwind and DaisyUI dependencies
- simplify `package.json`
- update `wails.json` build and dev commands

Do not remove the old stack before the replacement shell is functional. That only makes verification harder.

## How To Port the Current UI Patterns

### Tree view

This is the most important part of the rewrite.

Use:

- one root tree container in HTML
- one `<template>` for tree rows
- keyed `list(...)` for visible rows
- a computed array of visible entries from tree state

Each row binding should handle:

- selected vs primary-selected visual state
- folder expanded state
- drag state
- drop-position state
- modifier-key selection behavior

Recommendation: keep row rendering flat by visible-entry list, not recursive DOM islands. The current app already computes visible nodes for keyboard navigation. Lean into that. A flat render will make selection, search mode, and reordering easier to reason about.

### Detail panel

Render a stable right-pane shell and switch sections by selection state:

- no selection
- folder selection
- bookmark selection
- bulk selection

Use one state-driven renderer module to show/hide these panes. Avoid destroying and recreating the entire right pane unless necessary.

### Dialogs and overlays

Keep dialog containers in the main HTML and toggle them via state:

- confirm
- move
- import/merge
- keyboard shortcuts

Use focus trapping helpers exactly as the current app does. These workflows are desktop-app behaviors, not cosmetic details.

### Search mode

Search should remain a mode, not just a filter input.

Preserve:

- empty query shows tree mode
- active query shows result mode
- result keyboard navigation
- Enter jumps to detail
- Ctrl/Cmd+Enter opens the selected result

### Fetch-on-edit behavior

The bookmark add/edit flows debounce title and favicon fetches with race protection.

Preserve:

- 800ms debounce
- best-effort fetch behavior
- stale request invalidation
- no overwrite of user-entered title/icon unless the previous value was auto-filled

This logic is independent of framework choice and should port almost line-for-line.

## Daisylite Component Scope

Do not attempt to reproduce all of DaisyUI.

Minimum set needed for parity:

- button
- icon button
- input
- textarea
- field/label/help/error
- card
- badge
- alert
- modal
- toast
- toolbar
- menu/list item
- tree row
- divider
- spinner
- empty state
- status chip

Add app-specific components where semantic CSS beats generic primitives:

- titlebar
- resizable split layout
- tree row
- detail section
- dialog panel
- bulk action bar

This should be a design system for this app, not a public CSS framework.

## Feature-Parity Acceptance Checklist

The rewrite is not complete until all of these behave correctly:

- app opens with CLI-provided file path
- app can create a new bookmark file
- app can reopen last file
- tree renders correct nesting and counts
- tree expand/collapse persists per file
- search works across title and URL
- search results support keyboard navigation
- single selection works
- multi-select works only within allowed sibling groups
- range selection works
- tree keyboard navigation works
- add bookmark works with auto title/favicon fill
- add folder works
- edit bookmark works
- rename folder works
- delete bookmark works with confirmation
- delete folder works with confirmation
- bulk delete works
- move dialog works for single and bulk move
- drag-and-drop reorder works
- circular folder move prevention still relies on backend validation and is surfaced properly
- open in browser works
- single favicon refresh works
- bulk favicon refresh works
- bulk title refresh works
- import/merge preview works
- import/merge apply works
- undo works
- redo works
- toast messages still surface non-blocking outcomes
- confirm modal traps focus
- shortcuts dialog opens with `?` and `F1`
- global shortcuts still work
- focus-zone cycling works
- left-pane width persists
- window size persists
- frameless titlebar controls still work

## Risks and Mitigations

### Risk: rewriting tree behavior regresses selection semantics

Mitigation:

- port tree state first
- preserve current helper APIs conceptually
- validate against a manual behavior matrix before touching styling polish

### Risk: `naf-html` is too small for current UI complexity

Mitigation:

- keep the library tiny but allow two or three app-local helpers
- do not solve coordination by inventing a component framework
- place complex behavior in state/action modules, not in the reactive core

### Risk: removing Vite hurts dev workflow

Mitigation:

- treat no-Vite as the target architecture
- allow a temporary tiny static dev server script if needed
- avoid adding another framework-shaped tool just to recover comfort

### Risk: CSS migration expands uncontrollably

Mitigation:

- lock a minimum component inventory
- prefer semantic classes over utility explosion
- add app-specific component CSS when generic primitives stop paying off

## Recommended Execution Order

1. Write the feature-parity checklist from the current app.
2. Add the new frontend skeleton beside the old one.
3. Port `naf-html` to JS + JSDoc.
4. Add `daisylite` tokens, base styles, and core components.
5. Port state modules.
6. Port app shell orchestration.
7. Port tree and selection behavior.
8. Port detail flows and dialogs.
9. Port batch actions, history, and import/merge.
10. Verify every parity item manually.
11. Remove Svelte, TypeScript, Tailwind, DaisyUI, and Vite.
12. Update developer docs and build scripts.

## Bottom-Line Recommendation

This pivot is reasonable, but only if it is treated as an architectural rewrite with a strict parity contract.

The strongest implementation strategy is:

- keep Go and Wails intact
- replace the frontend with HTML-first ES modules
- adapt `naf-html` into a local JS runtime with JSDoc
- build a deliberately small `daisylite` CSS system
- port the current stateful desktop behaviors before chasing visual cleanup

If you do that, you will end up with a frontend that is simpler than the current one, easier to own long-term, and not dependent on Svelte, TypeScript, Tailwind, or DaisyUI.
