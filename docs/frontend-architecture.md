# Frontend Architecture

## Purpose

This frontend is a single-window Wails app built with:

- one static HTML shell
- plain JavaScript with `// @ts-check`
- a local NAF runtime in `shared/runtime/naf.js`
- signals/actions/computed/selectors shared state modules
- layered frontend modules instead of a framework component tree

The goal of this document is to help an engineer place new code correctly and understand how the app is composed.

## Reader

This document is for engineers changing the frontend.

After reading it, you should be able to:

- place a new page, feature, component, or helper in the right layer
- decide whether a module should use NAF templates or direct DOM code
- change the app shell without accidentally mixing page and feature responsibilities

## Frontend Shape

The frontend uses these top-level layers:

```text
frontend/src/
  app/
  pages/
  features/
  components/
  layouts/
  shared/
  styles/
```

The app boots once, keeps one running frontend process, and switches screen state inside that process.

There is no router. Page switching is driven by app state.

## Shell Model

The app uses one `index.html` file as a stable shell.

`index.html` should contain:

- the app frame
- stable mount anchors
- overlay roots
- static templates still required by specialized imperative rendering

`index.html` should not contain:

- page-specific markup
- dialog markup that can live with its module
- feature shells that can be owned by NAF templates

The shell is long-lived. Pages, dialogs, and feature surfaces mount into it.

## Runtime Model

The frontend runtime lives in `shared/runtime/naf.js`.

It combines:

- reactive primitives
- low-level DOM helpers
- NAF-style template and component helpers

The runtime is intentionally small. It is not a router, virtual DOM, or general-purpose framework.

Use the runtime at two levels:

- shell composition with `template()`, `mount()`, and `when()`
- `when()` is for simple two-way branches; use `effect()` for multi-way branching
- fine-grained behavior with `signal()`, `computed()`, `effect()`, `fx()`, `model()`, `list()`, and `cleanupCollector()`

Preferred shell authoring model:

1. define bounded markup with `template()`
2. mark owned nodes with `data-ref`
3. read them in `onMount(..., ctx)` via `ctx.refs`
4. mount through `mount(component, host)`

This keeps component ownership local and avoids broad parent-scoped DOM queries.

## Layer Roles

### `app/`

`app/` owns bootstrap and top-level orchestration.

Responsibilities:

- app startup
- session bootstrap and restore
- shell anchor collection
- page hosting and switching
- lifecycle wiring
- long-lived mounts that sit outside any one page

`app/` should not own feature workflows or page markup.

Use `app/` when changing:

- startup behavior
- shell-wide cleanup
- top-level page switching
- session restore rules

### `pages/`

`pages/` owns screen-level composition.

Current pages:

- library page
- empty-library page

A page decides which feature surfaces and shell pieces are active for one screen state.

Page responsibilities:

- define page-level markup or anchors
- activate the correct shell frame for the current screen state
- mount feature modules into the shell
- own page-specific cleanup
- translate app state into one active screen composition

Pages are the default home for `template()` when the UI represents a whole screen state.

### `features/`

`features/` owns product behavior.

Current features include:

- tree
- detail
- search
- import-merge
- move
- editing
- shortcuts

A feature can own:

- state
- selectors and actions
- workflows
- interaction rules
- feature-local view logic

Features do not need to be reusable outside this app.

Use `features/` when the code answers a product question, not a generic UI question.

### `components/`

`components/` owns reusable bounded UI pieces.

Current components include:

- titlebar
- toolbar actions
- toast container
- confirm modal
- keyboard shortcuts dialog

Components may have behavior, but they should not own broad product workflows.

Good component responsibilities:

- dialog chrome
- reusable shell sections
- contained controls
- shell-level UI that can be reused by pages or features

### `layouts/`

`layouts/` owns structural shell behavior.

Current layout:

- app shell layout and pane resizing

Use `layouts/` for:

- pane structure
- resizing
- structural shell rules

Do not use `layouts/` for feature behavior.

### `shared/`

`shared/` owns true cross-cutting dependencies.

Current shared areas include:

- API bindings
- infrastructure helpers
- runtime
- shared state
- shared styles

Shared state should expose the smallest clear surface that matches the domain.

Shared state should expose the smallest clear surface that matches the domain.

Canonical state module shape (signals/actions/computed/selectors):

```js
// Private signals (module-scoped, not exported directly)
const someValue = signal(initial);

export const someState = {
  signals: { someValue },
  computed: { derived },
  actions: { doSomething, setSomeValue },
  selectors: { getSomeValue, getDerived },
};
```

Rules:

- signals are private module-scoped consts, exposed only via the `signals` namespace
- actions mutate state and have clear JSDoc types
- selectors read state by calling signals or computed values
- computed values are exposed via the `computed` namespace for reactive reads
- internal helpers stay as module-scoped functions (not exported)

This pattern provides clear read vs write boundaries and prevents accidental signal mutation from outside the module. All state modules in this project follow this shape.

Only put code in `shared/` when the abstraction is genuinely reused and still clear.

### `styles/`

`styles/` owns app-wide style foundation and the CSS import hub.

Keep feature, page, component, and layout-specific CSS with the module that owns it when possible.

## NAF Placement Rules

Use NAF templates by default for:

- pages
- dialog shells
- reusable shell components
- bounded view shells where the main problem is localizing markup

Keep direct DOM ownership by default for:

- tree rendering
- drag and drop
- keyboard-heavy widgets
- dense detail and editing surfaces
- row-level binding where incremental updates matter

If a module is mostly markup plus a few listeners, prefer `template()`.

If a module is mostly field bindings, pointer rules, keyboard rules, or row-level effects, prefer direct DOM code with NAF helpers.

If a template-backed module mostly queries nodes it already owns, replace those queries with `data-ref` and `ctx.refs`.

## Page Switching Rules

This app does not use route state.

Page switching should be driven by frontend app state such as:

- current file path
- loading state
- recovered session state

Do not introduce URL or hash routing for empty-library versus loaded-library states.

## Placement Rules

Use this order when deciding where code belongs:

1. If it changes app startup, lifecycle, or page hosting/switching, put it in `app/`.
2. If it represents a whole screen state, put it in `pages/`.
3. If it owns product behavior or feature workflows, put it in `features/`.
4. If it is a reusable contained UI unit, put it in `components/`.
5. If it owns shell structure or resizing, put it in `layouts/`.
6. If it is a stable cross-feature abstraction, put it in `shared/`.

## Naming Rules

Use names that describe visible responsibility directly.

Preferred patterns:

- `*-page.js` for pages
- `*-dialog.js` for dialog entrypoints
- `*-layout.js` for layout modules
- `*-state.js` for state owners or facades
- `*-actions.js` for workflows and mutations
- `*-row.js` for row-level render and bind modules
- `*-keyboard.js` for keyboard interaction systems
- `*-dnd.js` for drag-and-drop systems
- `*-shell.js` for DOM factories or shell builders inside a feature

## Common Decisions

### When should a new top-level state become a page?

Make it a page when:

- it changes the main screen composition
- it enables or disables large shell regions
- it feels like a distinct app mode

Do not make it a page if it is only a feature state inside an existing screen.

### When should a feature use `template()`?

Use `template()` when:

- the feature needs local shell markup
- the markup is bounded
- the mount and unmount lifecycle is clear

Do not force `template()` into interaction-heavy modules just for consistency.

### When should code move to `shared/`?

Move code to `shared/` only when:

- at least two areas depend on it
- the abstraction is stable
- the shared name is still obvious

Do not move code to `shared/` just because a second caller might exist later.

## Examples

Use these as placement shortcuts:

- change startup or restore behavior: `app`
- change empty-state screen composition: `pages`
- change loaded-library composition: `pages`
- change tree behavior or selection rules: `features/tree`
- change detail editing flows: `features/detail`
- change import or move workflows: `features/import-merge` or `features/move`
- change titlebar, toolbar, or dialog chrome: `components`
- change pane layout or resizing: `layouts`
- change runtime helpers: `shared/runtime`

## Maintenance Rule

When a file starts mixing multiple reasons to change, split it within its current layer first.

Promote code to `shared/` only when the cross-feature abstraction is real and worth maintaining.
