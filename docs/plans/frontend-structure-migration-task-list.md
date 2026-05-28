# Frontend Structure Migration Task List

## Purpose

This is the execution companion to:

- `docs/plans/frontend-structure-proposal.md`

The goal is to move the frontend toward a domain-first structure without mixing structural moves with unrelated behavioral changes.

Work these tasks in order. Each task should be completed and verified before moving to the next.

## Working Rules

- Prefer mechanical moves and import updates over behavioral refactors during structure migration.
- Do not change naming and behavior in the same step unless the rename is required for clarity.
- Keep each task scoped to one app area or one structural concern.
- Build after every task that changes imports or file locations.
- Preserve the current runtime behavior unless the task explicitly says otherwise.

## Task List

### S01. Establish top-level domain folders and app/shared boundaries

Goal:

Create the target folder skeleton so later moves happen into a deliberate layout instead of one-off destinations.

Do:

- Create `frontend/src/app/`
- Create `frontend/src/domains/`
- Create `frontend/src/shared/`
- Under `domains/`, create the planned domain folders:
  - `tree`
  - `detail`
  - `search`
  - `dialogs`
  - `shortcuts`
  - `chrome`
  - `editing`
- Under `shared/`, create:
  - `api`
  - `infra`
  - `runtime`
  - `state`
  - `styles`

Deliverables:

- New empty folder structure in `frontend/src/`

Verify:

- The folder layout exists and matches the proposal.
- No runtime behavior changes yet.

Depends on:

- None

### S02. Move app bootstrap and shell orchestration into `app/`

Goal:

Make app startup and app-wide composition easy to find under one top-level area.

Do:

- Move `frontend/src/app.js` to `frontend/src/app/create-app.js`
- Move `frontend/src/lib/app-lifecycle.js` to `frontend/src/app/lifecycle.js`
- Move `frontend/src/lib/app-session.js` to `frontend/src/app/session.js`
- Move `frontend/src/lib/app-shell-actions.js` to `frontend/src/app/shell-actions.js`
- Update imports to point at the new locations.
- Keep the exported `createApp()` entrypoint stable.

Deliverables:

- App bootstrap files under `frontend/src/app/`
- Updated imports across the frontend

Verify:

- App startup still works.
- `createApp()` still mounts the app correctly.
- `npm run build` passes in `frontend/`

Depends on:

- S01

### S03. Move shared runtime and infrastructure into `shared/`

Goal:

Make it obvious which code is genuinely reusable across domains.

Do:

- Move:
  - `frontend/src/lib/naf-html.js` -> `frontend/src/shared/runtime/naf-html.js`
  - `frontend/src/lib/api.js` -> `frontend/src/shared/api/api.js`
  - `frontend/src/lib/errors.js` -> `frontend/src/shared/infra/errors.js`
  - `frontend/src/lib/focus.js` -> `frontend/src/shared/infra/focus.js`
  - `frontend/src/lib/persistence.js` -> `frontend/src/shared/infra/persistence.js`
- Update imports everywhere.
- Do not change behavior.

Deliverables:

- Shared runtime and infrastructure files under `frontend/src/shared/`

Verify:

- All imports resolve cleanly.
- `npm run build` passes in `frontend/`

Depends on:

- S02

### S04. Move app-global state into `shared/state/`

Goal:

Separate app-global state from domain-local state.

Do:

- Move:
  - `frontend/src/lib/state/app-state.js` -> `frontend/src/shared/state/app-state.js`
  - `frontend/src/lib/state/ui-state.js` -> `frontend/src/shared/state/ui-state.js`
- Update imports everywhere.
- Keep behavior unchanged.

Deliverables:

- Shared app/global state under `frontend/src/shared/state/`

Verify:

- App-global state imports still resolve.
- `npm run build` passes in `frontend/`

Depends on:

- S03

### S05. Move tree code into `domains/tree/`

Goal:

Make tree code navigable by domain first, then by responsibility.

Do:

- Move tree state files into:
  - `frontend/src/domains/tree/state/`
- Move tree view files into:
  - `frontend/src/domains/tree/view/`
- Move tree interaction files into:
  - `frontend/src/domains/tree/interactions/`
- Update imports everywhere.
- Keep the current tree behavior unchanged.

Deliverables:

- Tree code fully under `frontend/src/domains/tree/`

Verify:

- Tree rendering still works.
- Tree keyboard behavior still works.
- Tree drag/drop still works.
- `npm run build` passes in `frontend/`

Depends on:

- S04

### S06. Move detail code into `domains/detail/`

Goal:

Group all detail-surface code under one domain.

Do:

- Move detail panel and detail views into `frontend/src/domains/detail/view/`
- Move detail workflows into `frontend/src/domains/detail/actions/`
- Update imports everywhere.
- Keep bookmark detail, folder detail, and bulk-selection detail behavior unchanged.

Deliverables:

- Detail domain files under `frontend/src/domains/detail/`

Verify:

- Bookmark detail still works.
- Folder detail still works.
- Bulk-selection detail still works.
- `npm run build` passes in `frontend/`

Depends on:

- S05

### S07. Move search code into `domains/search/`

Goal:

Keep search UI and search state together under one domain.

Do:

- Move `search-state.js` into `frontend/src/domains/search/state/`
- Move `search-bar.js` into `frontend/src/domains/search/view/`
- Update imports everywhere.

Deliverables:

- Search domain files under `frontend/src/domains/search/`

Verify:

- Search still filters and highlights results correctly.
- `npm run build` passes in `frontend/`

Depends on:

- S06

### S08. Move dialogs into `domains/dialogs/`

Goal:

Make modal/dialog code discoverable by dialog type instead of spread between `features/` and `state/`.

Do:

- Move confirm modal into `domains/dialogs/confirm/`
- Move move dialog plus move dialog state into `domains/dialogs/move/`
- Move import/merge dialog files plus import/merge state into `domains/dialogs/import-merge/`
- Move keyboard shortcuts dialog into `domains/dialogs/keyboard-shortcuts/`
- Update imports everywhere.

Deliverables:

- Dialog code grouped by dialog type under `frontend/src/domains/dialogs/`

Verify:

- Confirm modal still works.
- Move dialog still works.
- Import/merge dialog still works.
- Keyboard shortcuts dialog still works.
- `npm run build` passes in `frontend/`

Depends on:

- S07

### S09. Move global shortcut logic into `domains/shortcuts/`

Goal:

Group keyboard shortcut dispatch and helper logic under one domain.

Do:

- Move all `global-shortcuts*.js` files into `frontend/src/domains/shortcuts/`
- Update imports everywhere.
- Keep shortcut behavior unchanged.

Deliverables:

- Shortcuts domain files under `frontend/src/domains/shortcuts/`

Verify:

- Existing keyboard shortcuts still work.
- `npm run build` passes in `frontend/`

Depends on:

- S08

### S10. Move shell/chrome UI into `domains/chrome/`

Goal:

Make titlebar, shell layout, and toast UI easy to find as app chrome.

Do:

- Move:
  - `titlebar.js`
  - `layout.js`
  - `toast-container.js`
- Place them under `frontend/src/domains/chrome/`
- Update imports everywhere.

Deliverables:

- Chrome domain files under `frontend/src/domains/chrome/`

Verify:

- Titlebar still works.
- Layout resizing still works.
- Toasts still render correctly.
- `npm run build` passes in `frontend/`

Depends on:

- S09

### S11. Move bookmark/folder creation forms into `domains/editing/`

Goal:

Group editing-entry surfaces under a clearer domain name than generic `features/`.

Do:

- Move:
  - `add-bookmark-form.js`
  - `add-folder-form.js`
- Place them under `frontend/src/domains/editing/`
- Update imports everywhere.

Deliverables:

- Editing domain files under `frontend/src/domains/editing/`

Verify:

- Add bookmark flow still works.
- Add folder flow still works.
- `npm run build` passes in `frontend/`

Depends on:

- S10

### S12. Move shared styles into `shared/styles/`

Goal:

Separate genuinely reusable style primitives from domain-owned styles.

Do:

- Move shared component styles into `frontend/src/shared/styles/`
- Keep only global style foundation in `frontend/src/styles/`
- Update `frontend/src/styles/app.css` imports.

Deliverables:

- Shared style primitives under `frontend/src/shared/styles/`

Verify:

- Shared UI primitives still render the same.
- `npm run build` passes in `frontend/`

Depends on:

- S11

### S13. Move domain-owned styles alongside their domains

Goal:

Put styles where a developer would expect to find them based on the UI area they belong to.

Do:

- Move tree styles into `frontend/src/domains/tree/styles/`
- Move detail styles into `frontend/src/domains/detail/styles/`
- Move chrome styles into `frontend/src/domains/chrome/styles/`
- Update `frontend/src/styles/app.css` imports.

Deliverables:

- Domain-owned styles under their respective domain folders

Verify:

- Tree, detail, and chrome surfaces still render the same.
- `npm run build` passes in `frontend/`

Depends on:

- S12

### S14. Remove obsolete `lib/features/` and `lib/state/` remnants

Goal:

Finish the migration so the old structure stops competing with the new one.

Do:

- Remove unused placeholder files and empty folders under:
  - `frontend/src/lib/features/`
  - `frontend/src/lib/state/`
  - any now-obsolete intermediate structure
- Verify there are no stale imports referencing the old layout.

Deliverables:

- Old structural directories removed or empty by design

Verify:

- No imports point to obsolete locations.
- `npm run build` passes in `frontend/`

Depends on:

- S13

### S15. Add a short architecture note for future contributors

Goal:

Make the new structure durable by documenting the mental model and placement rules.

Do:

- Add a short frontend architecture note or update an existing doc.
- Document:
  - domain-first organization
  - when code belongs in `app/`
  - when code belongs in `domains/*`
  - when code belongs in `shared/*`
  - how to place styles

Deliverables:

- New or updated architecture note in `docs/`

Verify:

- The document explains the intended structure clearly enough that future files can follow it.

Depends on:

- S14
