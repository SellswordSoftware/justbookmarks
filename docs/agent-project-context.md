# Agent Project Context

## Purpose

This is a short project brief for future agents working in this repository.

After reading it, an agent should understand:

- what the app is
- how the frontend is structured now
- what conventions matter most
- how to make safe changes without undoing recent architectural work

## What This Project Is

JustBookmarks is a Tauri desktop app for managing one bookmark HTML file in Netscape bookmark format.

Core user workflows:

- open an existing bookmark file
- create a new bookmark file
- browse the bookmark tree
- search bookmarks
- add, edit, move, and delete bookmarks and folders
- import and merge another bookmark file
- work from the keyboard when possible

The app is intentionally file-based. It is not a cloud product and does not use a proprietary local database.

The project has two main sides:

- `src/` for the frontend
- `src-tauri/` for the Rust desktop host, Tauri config, and command wiring

## Frontend Status

The frontend has recently gone through major restructuring.

Current model:

- one `src/index.html` shell
- plain JavaScript with `// @ts-check`
- one local runtime in `src/shared/runtime/naf.js`
- signals/actions/computed/selectors shared state modules
- layered frontend structure

Current frontend layout:

```text
src/
  app/
  pages/
  features/
  components/
  layouts/
  shared/
  styles/
```

Important rule:

- do not assume older `frontend/` paths, Wails integration, or separate `naf-html.js` structure still apply

## Current Frontend Architecture

Use these layers as the source of truth:

- `app`
  - startup, lifecycle, shell collection, page hosting
- `pages`
  - screen-level composition
- `features`
  - product behavior and workflows
- `components`
  - reusable bounded UI pieces
- `layouts`
  - shell structure and resizing
- `shared`
  - cross-cutting runtime, API, infra, and shared state

Two current page states matter most:

- empty-library page
- library page

Page switching is state-driven. There is no router.

## NAF Runtime Rules

The single runtime entrypoint is:

- `src/shared/runtime/naf.js`

It currently owns both:

- low-level helpers: `signal`, `computed`, `effect`, `fx`, `model`, `list`, `cleanupCollector`, `listener`, `show`, `hide`, `requireRef`, `requireElement`, `collectRowRefs`, `$`, `$$`, `attr`, `setText`, `text`
- shell composition helpers: `template()`, `mount()`, and `when()`

Note: `when()` is for simple two-way branches only. For multi-way branching, use an explicit `effect()` with if/else logic.

Note: `list()` accepts string template constants (for example `` `...` ``) in addition to `HTMLTemplateElement`; strings are converted internally.

Use NAF templates by default for:

- pages
- dialog shells
- reusable shell components
- bounded view shells

Keep direct DOM ownership by default for:

- tree rendering
- drag and drop
- keyboard-heavy widgets
- dense detail and editing surfaces

Current preferred shell pattern:

- define local markup with `template()`
- mark owned elements with `data-ref`
- use `onMount(..., ctx)` and `ctx.refs`
- mount with `mount(component, host)`

Current shared state pattern:

- read app state through selectors such as `appState.selectors.getCurrentFilePath()`
- use actions for mutations such as `appState.actions.setCurrentFilePath(path)`
- use the signals/actions/computed/selectors pattern consistently across all state modules
- do not reintroduce flat domain-group patterns or broad `selectors/actions/signals` wrapper namespaces that differ from this shape

Do not introduce a router for page switching.

## Shell Rules

`src/index.html` is a shell, not a template graveyard.

Keep it focused on:

- app frame
- stable mount anchors
- overlay roots
- static templates still required by specialized imperative rendering

Do not move page or dialog markup back into `src/index.html` unless there is a strong reason.

## Desktop Host Boundary

The desktop host lives under `src-tauri/`.

Use that side of the repo for:

- Tauri app configuration
- Rust command handlers
- file-system and desktop integration
- native window behavior

Frontend modules should talk to the desktop host through the shared API layer rather than scattering Tauri-specific calls through feature code.

## Recent Migration Reality

A lot of code has been moved recently.

Important consequences:

- prefer mechanical changes over opportunistic refactors
- preserve behavior unless the task explicitly changes behavior
- be careful around `src/app/create-app.js`
- be careful around `src/app/page-host.js`
- be careful around `src/shared/api/api.js` and `src/shared/api/tauri-api-bindings.js`
- do not reintroduce old folder concepts that the layered structure replaced

If you are touching frontend architecture, read these first:

- `docs/frontend-architecture.md`
- `docs/frontend-maintainability-guidelines.md`
- `docs/naf-html-usage-guidelines.md`

## Safe Working Rules

When changing the frontend:

- keep `app/` thin
- keep page logic in `pages/`
- keep product workflows in `features/`
- keep reusable shell UI in `components/`
- do not move code to `shared/` just because it might be reused later

When restructuring:

- prefer small, mechanical migrations
- update imports cleanly
- avoid mixing unrelated refactors into migration work
- do not revert unrelated user changes in the worktree

## Verification

For frontend changes, the standard verification is:

```bash
npm run typecheck
npm test
```

Add browser verification when the change affects rendered UI, focus handling, keyboard behavior, or other DOM-heavy flows:

```bash
npm run test:browser
```

Use the coverage commands when the task is specifically about test reach, instrumentation, or report generation:

```bash
npm run test:coverage
npm run test:browser:coverage
npm run test:coverage:all
```

If the task touches desktop integration, Tauri configuration, or Rust command wiring, also verify with:

```bash
npm run tauri dev
```

Use `npm run tauri build` when release/build behavior is part of the change.

## Suggested First Read For Agents

If you are starting cold, read in this order:

1. `README.md`
2. `docs/frontend-architecture.md`
3. `docs/frontend-maintainability-guidelines.md`
4. `docs/naf-html-usage-guidelines.md`
5. the specific module you are changing

## Common Mistakes To Avoid

- introducing route-style navigation for page state
- forcing `template()` into tree or detail modules just for consistency
- putting product workflows into `components/`
- growing `src/index.html` with page or dialog markup
- promoting unstable code into `shared/`
- mixing architectural migration with unrelated cleanup

## If You Need A Default Approach

When unsure:

1. keep the change local
2. preserve current behavior
3. follow the existing layer ownership
4. use `naf.js` as the only runtime entrypoint
5. verify with typecheck and tests
