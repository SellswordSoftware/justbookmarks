# Frontend Architecture

## Purpose

The frontend uses a domain-first structure so the first question is "what app area is this?" instead of "is this feature code or state code?"

This keeps navigation predictable:

- go to `app/` for startup and app-wide wiring
- go to `domains/<name>/` for product behavior in one area
- go to `shared/` only for code reused across multiple domains
- go to `styles/` only for global style foundation

## Top-Level Layout

```text
frontend/src/
  app/
  domains/
  shared/
  styles/
```

### `app/`

Owns bootstrap and app-wide composition:

- app creation
- startup and session restore
- lifecycle wiring
- shell-level action wiring

`app/` should not become a dumping ground for feature logic. If code mainly belongs to one app area, move it to that domain.

### `domains/`

Each domain is a user-facing app area such as:

- `tree`
- `detail`
- `search`
- `dialogs`
- `shortcuts`
- `chrome`
- `editing`

Inside a domain, split by responsibility only as needed:

- `view/` for DOM creation, rendering, and bindings
- `state/` for domain-owned state and selectors
- `interactions/` for keyboard, pointer, and drag/drop systems
- `actions/` for domain workflows and mutations
- `styles/` for styles owned by that domain

Not every domain needs every subfolder. Add structure when it clarifies responsibility.

### `shared/`

Only place code here when it is genuinely cross-domain:

- `api/` for backend bindings and transport helpers
- `infra/` for shared utilities like focus, persistence, and errors
- `runtime/` for local reactive/runtime primitives
- `state/` for app-global state that is not owned by one domain
- `styles/` for reusable visual primitives

If a module is mainly used by one domain, keep it with that domain even if another area might reuse it later.

### `styles/`

This folder is for app-wide style foundation only:

- reset
- tokens
- themes
- base element styling
- layout scaffolding
- the top-level `app.css` import hub

Feature or surface styles should live with the domain that owns them.

## Placement Rules

Use these rules when adding or moving code:

1. Start with the domain. If the code belongs to tree behavior, put it under `domains/tree/`.
2. Keep DOM-free domain logic in that domain's `state/` or `actions/` before promoting it to `shared/`.
3. Put keyboard, pointer, and drag/drop systems in `interactions/` when they are substantial enough to deserve their own module.
4. Put reusable visual primitives in `shared/styles/`. Put surface-specific styling in the domain's `styles/`.
5. Only put code in `shared/` when at least two domains depend on it and the abstraction is still clear.

## Naming Rules

- `*-state.js` means state owner or state facade
- `*-actions.js` means workflow or mutation helpers
- `*-dialog.js` means a dialog entrypoint or composition layer
- `*-row.js` means a row-level renderer or binding module
- `*-keyboard.js` and `*-dnd.js` mean interaction systems

Prefer names that describe the visible responsibility directly. Avoid vague names that require history to understand.

## Practical Examples

- Change tree indentation or row markup: start in `frontend/src/domains/tree/view/`
- Change tree selection or expansion rules: start in `frontend/src/domains/tree/state/`
- Change move dialog behavior: start in `frontend/src/domains/dialogs/move/`
- Change app startup or restore flow: start in `frontend/src/app/`
- Change button, modal, or form primitives: start in `frontend/src/shared/styles/`

## Maintenance Rule

When a file starts mixing multiple reasons to change, split it within its current domain before creating a new cross-domain abstraction.
