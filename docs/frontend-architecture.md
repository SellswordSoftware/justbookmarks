# Frontend Architecture

## Purpose

The frontend now uses a layered structure that separates bootstrap, pages, features, reusable UI pieces, shell layout, and shared infrastructure.

Use this model to answer "what level of the app owns this code?" before deciding which folder it belongs in.

## Top-Level Layout

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

## Layer Roles

### `app/`

Owns bootstrap and lifecycle only:

- app startup
- session bootstrap and file restore
- top-level shell anchor collection
- page selection
- lifecycle persistence wiring

`app/` should compose the frontend, not own feature behavior.

### `pages/`

Owns screen-level composition.

Current pages:

- `pages/library/`
  - loaded bookmark-library experience
- `pages/empty-library/`
  - no-file experience before a library is open

If a new top-level app state appears, start by asking whether it should become a page.

### `features/`

Owns behavior-rich product areas:

- `tree`
- `detail`
- `search`
- `import-merge`
- `move`
- `editing`
- `shortcuts`

Features can contain state, DOM bindings, workflows, and interactions. They do not need to be reusable outside this app.

### `components/`

Owns reusable, bounded UI units:

- `titlebar`
- `toolbar`
- `toast`
- `confirm-modal`
- `keyboard-shortcuts-dialog`
- `shell-panel`

Components may have local state and event handling, but they should not own broad product workflows.

### `layouts/`

Owns shell structure and structural interaction:

- `app-shell`
  - pane layout
  - pane resizing

Use `layouts/` for the app frame that sits between pages and smaller UI pieces.

### `shared/`

Owns only true cross-feature dependencies:

- `api/`
- `infra/`
- `runtime/`
- `state/`
- `styles/`

If code mainly serves one feature or one component, keep it there even if reuse seems possible later.

### `styles/`

Owns app-wide style foundation and the top-level import hub:

- reset
- tokens
- themes
- base styles
- global layout primitives
- `app.css`

Feature, component, or layout-owned styles should live with the module that owns them.

## Placement Rules

1. Start at the highest meaningful layer.
2. If code describes a whole screen state, put it in `pages/`.
3. If code owns product behavior, state, or workflows, put it in `features/`.
4. If code is a reusable contained UI unit, put it in `components/`.
5. If code defines shell structure or structural resizing, put it in `layouts/`.
6. Only put code in `shared/` when at least two areas depend on it and the abstraction is still clear.
7. Keep `app/` thin. If it starts accumulating product logic, move that logic down into pages, features, components, or layouts.

## Naming Rules

- `*-page.js` for page compositions
- `*-layout.js` for shell layout modules
- `*-state.js` for state owners or facades
- `*-actions.js` for workflows and mutations
- `*-dialog.js` for dialog composition entrypoints
- `*-row.js` for row-level render/bind modules
- `*-keyboard.js` and `*-dnd.js` for interaction systems

Prefer names that describe visible responsibility directly.

## Repo-Specific Examples

- Change app startup or page switching: start in `frontend/src/app/`
- Change loaded-library composition: start in `frontend/src/pages/library/`
- Change empty/no-file experience: start in `frontend/src/pages/empty-library/`
- Change tree rendering or selection behavior: start in `frontend/src/features/tree/`
- Change bookmark or folder detail behavior: start in `frontend/src/features/detail/`
- Change import/merge or move workflow: start in `frontend/src/features/import-merge/` or `frontend/src/features/move/`
- Change titlebar, toast, or toolbar UI: start in `frontend/src/components/`
- Change pane resizing or shell structure: start in `frontend/src/layouts/app-shell/`

## Maintenance Rule

When a file starts mixing multiple reasons to change, split it within its current layer first. Promote code to `shared/` only when the cross-layer dependency is real and stable.
