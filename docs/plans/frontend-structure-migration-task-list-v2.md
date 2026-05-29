# Frontend Structure Migration Task List V2

## Purpose

This is the execution companion to:

- `docs/plans/frontend-structure-proposal-v2.md`

The goal is to move the frontend from the current `domains/` structure to a more transferable layered structure:

- `pages`
- `features`
- `components`
- `layouts`
- `shared`
- `styles`

Work these tasks in order. Each task should be completed and verified before moving to the next.

## Working Rules

- Prefer mechanical moves and import updates over behavioral refactors during structure migration.
- Do not mix folder renames with unrelated product changes.
- Keep page extraction separate from feature moves where possible.
- Build after every task that changes imports or file locations.
- Preserve runtime behavior unless the task explicitly says otherwise.
- Introduce new layers only when they have real occupants; do not create empty taxonomy beyond the planned skeleton.

## Task List

### V01. Establish the new top-level folder skeleton

Goal:

Create the target top-level layout for the layered structure before moving code into it.

Do:

- Create:
  - `frontend/src/pages/`
  - `frontend/src/features/`
  - `frontend/src/components/`
  - `frontend/src/layouts/`
- Keep existing `app/`, `shared/`, and `styles/`.
- Under `features/`, create:
  - `tree`
  - `detail`
  - `search`
  - `import-merge`
  - `move`
  - `editing`
  - `shortcuts`
- Under `components/`, create:
  - `confirm-modal`
  - `keyboard-shortcuts-dialog`
  - `toast`
  - `titlebar`
  - `toolbar`
  - `shell-panel`
  - `empty-state`
- Under `layouts/`, create:
  - `app-shell`
- Under `pages/`, create:
  - `empty-library`
  - `library`

Deliverables:

- New top-level folder skeleton under `frontend/src/`

Verify:

- The folder layout exists and matches the v2 proposal.
- No runtime behavior changes yet.

Depends on:

- None

### V02. Rename `domains/tree/` to `features/tree/`

Goal:

Make the first major behavior area use the new `features/` naming model.

Do:

- Move `frontend/src/domains/tree/` to `frontend/src/features/tree/`
- Update imports everywhere.
- Keep state, view, interactions, and styles subfolders intact.

Deliverables:

- Tree code under `frontend/src/features/tree/`

Verify:

- Tree rendering still works.
- Tree keyboard behavior still works.
- Tree drag/drop still works.
- `npm run build` passes in `frontend/`

Depends on:

- V01

### V03. Rename `domains/detail/` to `features/detail/`

Goal:

Move the detail area into the new `features/` structure.

Do:

- Move `frontend/src/domains/detail/` to `frontend/src/features/detail/`
- Update imports everywhere.
- Keep `view`, `actions`, and `styles` structure unchanged.

Deliverables:

- Detail code under `frontend/src/features/detail/`

Verify:

- Bookmark detail still works.
- Folder detail still works.
- Bulk-selection detail still works.
- `npm run build` passes in `frontend/`

Depends on:

- V02

### V04. Rename `domains/search/` to `features/search/`

Goal:

Place search behavior under `features/` with the rest of the product areas.

Do:

- Move `frontend/src/domains/search/` to `frontend/src/features/search/`
- Update imports everywhere.

Deliverables:

- Search code under `frontend/src/features/search/`

Verify:

- Search still filters and highlights results correctly.
- `npm run build` passes in `frontend/`

Depends on:

- V03

### V05. Split dialog workflows into `features/import-merge/` and `features/move/`

Goal:

Treat import/merge and move as feature workflows instead of dialog categories.

Do:

- Move:
  - `frontend/src/domains/dialogs/import-merge/*` -> `frontend/src/features/import-merge/`
  - `frontend/src/domains/dialogs/move/*` -> `frontend/src/features/move/`
- Update imports everywhere.
- Keep the internal files and behavior unchanged.

Deliverables:

- Import/merge workflow under `frontend/src/features/import-merge/`
- Move workflow under `frontend/src/features/move/`

Verify:

- Import/merge dialog still works.
- Move dialog still works.
- `npm run build` passes in `frontend/`

Depends on:

- V04

### V06. Rename `domains/editing/` and `domains/shortcuts/` to `features/`

Goal:

Finish the feature-layer rename for behavior-owned areas.

Do:

- Move:
  - `frontend/src/domains/editing/` -> `frontend/src/features/editing/`
  - `frontend/src/domains/shortcuts/` -> `frontend/src/features/shortcuts/`
- Update imports everywhere.

Deliverables:

- Editing and shortcuts under `frontend/src/features/`

Verify:

- Add bookmark flow still works.
- Add folder flow still works.
- Existing keyboard shortcuts still work.
- `npm run build` passes in `frontend/`

Depends on:

- V05

### V07. Move reusable dialogs into `components/`

Goal:

Separate reusable contained UI units from behavior-rich features.

Do:

- Move:
  - `frontend/src/domains/dialogs/confirm/confirm-modal.js` -> `frontend/src/components/confirm-modal/confirm-modal.js`
  - `frontend/src/domains/dialogs/keyboard-shortcuts/keyboard-shortcuts-dialog.js` -> `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js`
- Update imports everywhere.

Deliverables:

- Reusable dialog components under `frontend/src/components/`

Verify:

- Confirm modal still works.
- Keyboard shortcuts dialog still works.
- `npm run build` passes in `frontend/`

Depends on:

- V06

### V08. Move chrome UI pieces into `components/`

Goal:

Turn reusable shell UI pieces into explicit components rather than keeping them under a vague chrome area.

Do:

- Move:
  - `frontend/src/domains/chrome/titlebar.js` -> `frontend/src/components/titlebar/titlebar.js`
  - `frontend/src/domains/chrome/toast-container.js` -> `frontend/src/components/toast/toast-container.js`
  - `frontend/src/app/shell-actions.js` -> `frontend/src/components/toolbar/toolbar-actions.js`
- Move related styles:
  - `frontend/src/domains/chrome/styles/titlebar.css` -> `frontend/src/components/titlebar/titlebar.css`
  - `frontend/src/domains/chrome/styles/toolbar.css` -> `frontend/src/components/toolbar/toolbar.css`
  - `frontend/src/domains/chrome/styles/shell-panel.css` -> `frontend/src/components/shell-panel/shell-panel.css`
- Update imports everywhere.

Deliverables:

- Reusable shell UI pieces under `frontend/src/components/`

Verify:

- Titlebar still works.
- Toasts still render correctly.
- Toolbar actions still work.
- `npm run build` passes in `frontend/`

Depends on:

- V07

### V09. Move app shell structure into `layouts/app-shell/`

Goal:

Introduce an explicit structural layer for shell composition.

Do:

- Move `frontend/src/domains/chrome/layout.js` -> `frontend/src/layouts/app-shell/app-shell-layout.js`
- If layout-specific shell CSS is no longer truly global, move it from `frontend/src/styles/layout.css` into `frontend/src/layouts/app-shell/app-shell-layout.css`
- Keep truly global layout/reset/tokens styles in `frontend/src/styles/`
- Update imports everywhere.

Deliverables:

- App shell structure under `frontend/src/layouts/app-shell/`

Verify:

- Pane resizing still works.
- Overall shell layout still renders correctly.
- `npm run build` passes in `frontend/`

Depends on:

- V08

### V10. Introduce `pages/library/` as the loaded-file composition

Goal:

Create a real page-level composition boundary for the loaded bookmark experience.

Do:

- Extract the loaded-file app composition from `frontend/src/app/create-app.js` into:
  - `frontend/src/pages/library/library-page.js`
- Keep the page responsible for composing features, components, and layout pieces needed when a bookmark file is loaded.
- Update `create-app.js` to delegate to the page.

Deliverables:

- `library-page.js` as the loaded-file composition entrypoint

Verify:

- The main loaded-file experience still mounts correctly.
- `npm run build` passes in `frontend/`

Depends on:

- V09

### V11. Introduce `pages/empty-library/` as the no-file composition

Goal:

Make the empty/no-file state a first-class page instead of a conditional placeholder inside app bootstrap.

Do:

- Extract the no-file composition into:
  - `frontend/src/pages/empty-library/empty-library-page.js`
- If the empty state grows beyond a trivial placeholder, add:
  - `frontend/src/components/empty-state/empty-state-card.js`
  - `frontend/src/components/empty-state/empty-state-card.css`
- Update `create-app.js` or the library page routing logic to switch between empty and loaded pages.

Deliverables:

- `empty-library-page.js` for the no-file state

Verify:

- The app still shows an appropriate empty state before a file is opened.
- Switching from no-file to loaded-file still works.
- `npm run build` passes in `frontend/`

Depends on:

- V10

### V12. Simplify `app/create-app.js` to bootstrap plus page selection

Goal:

Reduce `app/` to bootstrap and lifecycle orchestration only.

Do:

- Keep `frontend/src/app/create-app.js` focused on:
  - collecting stable top-level shell anchors
  - mounting shared lifecycle pieces
  - choosing between page compositions
- Move any lingering feature or component-specific logic into the correct layer.

Deliverables:

- A smaller `create-app.js` that mainly bootstraps and delegates

Verify:

- App startup still works.
- Page selection still works.
- `npm run build` passes in `frontend/`

Depends on:

- V11

### V13. Remove obsolete `domains/` remnants

Goal:

Finish the rename so the old `domains/` structure stops competing with the new model.

Do:

- Remove any unused files or empty folders under `frontend/src/domains/`
- Verify there are no stale imports referencing `domains/`

Deliverables:

- Old `domains/` structure removed or empty by design

Verify:

- No imports point at `frontend/src/domains/`
- `npm run build` passes in `frontend/`

Depends on:

- V12

### V14. Normalize style imports by ownership

Goal:

Make `app.css` read as a clear import map for global, component, feature, and layout styles.

Do:

- Review `frontend/src/styles/app.css`
- Keep only:
  - global foundation imports from `styles/`
  - shared primitive imports from `shared/styles/`
  - owned imports from `components/`, `features/`, and `layouts/`
- Remove any leftover import paths that reflect the old structure.

Deliverables:

- Clean top-level style import hub aligned with the v2 structure

Verify:

- Styles still load in the expected order.
- `npm run build` passes in `frontend/`

Depends on:

- V13

### V15. Add architecture docs for the new layered model

Goal:

Document the new structure so future work follows the intended mental model.

Do:

- Update or replace the current architecture note so it explains:
  - `app`
  - `pages`
  - `features`
  - `components`
  - `layouts`
  - `shared`
  - `styles`
- Include placement rules and a few repo-specific examples.

Deliverables:

- Updated frontend architecture documentation

Verify:

- A new contributor could use the doc to decide where a file should live.

Depends on:

- V14

### V16. Final cleanup pass and structure review

Goal:

Confirm that the migration actually improved navigation and did not leave ambiguous leftovers.

Do:

- Review the resulting tree for misplaced files
- Check for obvious naming mismatches
- Note any follow-up refactors that became clearer after the move

Deliverables:

- Final migration review notes

Verify:

- `npm run build` passes in `frontend/`
- The repo structure matches the v2 proposal closely enough to teach as the default pattern

Depends on:

- V15
