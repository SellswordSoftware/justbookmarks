# Frontend Maintainability Task List

## Purpose

This is the execution companion to the maintainability review based on:

- `docs/naf-html-usage-guidelines.md`
- `docs/frontend-maintainability-guidelines.md`

Work these tasks in order. Each task is intended to be completed and verified before moving to the next.

## Working Rules

- Split by responsibility, not only by line count.
- Prefer `signal()`, `fx()`, `model()`, and `list()` over manual render wiring when that makes the module clearer.
- Keep `state/*` focused on state ownership, selectors, computed values, and actions.
- Avoid mixing DOM creation, async workflows, and keyboard/pointer rules in the same module unless there is a strong cohesion reason.
- Do not invent generic abstractions unless at least two modules need them.

## Task List

### T01. Split `treeState` by responsibility

Goal:

Reduce `frontend/src/lib/state/tree-state.js` to a focused state owner instead of a catch-all module.

Do:

- Extract tree normalization helpers.
- Extract tree traversal and lookup helpers.
- Extract selection rules and selection restore helpers.
- Keep the exported `treeState` surface stable if possible.
- Leave DOM concerns out of the resulting state modules.

Deliverables:

- Smaller `frontend/src/lib/state/tree-state.js`
- New helper modules alongside it, if needed

Verify:

- `treeState` still owns signals, computed values, selectors, and actions.
- Loading, refresh, selection, and persistence restore behavior still work.
- The main state file is materially easier to scan.

Depends on:

- None

### T02. Split `bookmark-tree` into tree rendering, keyboard navigation, and drag/drop concerns

Goal:

Reduce `frontend/src/lib/features/bookmark-tree.js` to one clear UI surface with submodules for distinct interaction systems.

Do:

- Extract drag-and-drop hit testing and move orchestration.
- Extract tree keyboard navigation rules.
- Extract search-result row rendering if it remains custom.
- Keep the mount API stable for the rest of the app.

Deliverables:

- Smaller `frontend/src/lib/features/bookmark-tree.js`
- New tree submodules under `frontend/src/lib/features/`

Verify:

- Tree rendering still works in browse mode and search mode.
- Keyboard navigation still works.
- Drag-and-drop behavior still works.
- The main feature file no longer mixes all tree interaction concerns inline.

Depends on:

- T01

### T03. Break up `global-shortcuts` into a command map plus focused handlers

Goal:

Make global keyboard behavior easier to scan and safer to change.

Do:

- Extract focus-zone helpers.
- Extract selection mutation shortcuts.
- Extract file/session shortcuts.
- Extract search activation and history shortcuts.
- Replace the long branching key handler with a clearer command-routing structure.

Deliverables:

- Smaller `frontend/src/lib/features/global-shortcuts.js`
- New shortcut helper modules if needed

Verify:

- Existing keyboard shortcuts still work.
- The main keydown handler reads as dispatch logic, not workflow implementation.
- Related shortcut behavior is grouped by concern.

Depends on:

- T02

### T04. Split `bookmark-detail` into view wiring, metadata workflow, and item actions

Goal:

Reduce `frontend/src/lib/features/bookmark-detail.js` to a cohesive feature module with smaller sub-parts.

Do:

- Extract DOM creation or shell collection for the bookmark detail surface.
- Extract debounced metadata autofill behavior.
- Extract destructive and mutation actions such as save, delete, move, and open.
- Keep `fx()` bindings close to the elements they affect where possible.

Deliverables:

- Smaller `frontend/src/lib/features/bookmark-detail.js`
- New bookmark-detail helper modules

Verify:

- Edit mode still works.
- Metadata autofill still works.
- Save, delete, move, open, and favicon fetch actions still work.
- The remaining feature file has one clear responsibility.

Depends on:

- T03

### T05. Convert `bulk-selection-detail` away from manual `render()` syncing

Goal:

Bring `frontend/src/lib/features/bulk-selection-detail.js` in line with the project’s preferred `naf-html` usage.

Do:

- Replace the imperative `render()` flow with `fx()` bindings and local signals where appropriate.
- Keep action handlers explicit.
- Avoid rebuilding the whole surface for simple state changes.

Deliverables:

- Refactored `frontend/src/lib/features/bulk-selection-detail.js`

Verify:

- Busy states still update correctly.
- Bulk action labels and disabled states still update correctly.
- The file no longer depends on repeated manual `render()` calls.

Depends on:

- T04

### T06. Split `appState` into session/window state and import-merge state

Goal:

Keep `frontend/src/lib/state/app-state.js` from becoming the default home for unrelated app concerns.

Do:

- Extract import/merge dialog state and workflows.
- Consider whether keyboard-shortcuts dialog state should stay here or move into a smaller UI state module.
- Keep runtime window integration separate from dialog workflows.

Deliverables:

- Smaller `frontend/src/lib/state/app-state.js`
- New state module for import/merge concerns

Verify:

- Startup file loading still works.
- Window persistence still works.
- Import/merge open, preview, apply, and error states still work.

Depends on:

- T05

### T07. Break `app.js` into bootstrap and composition helpers

Goal:

Reduce `frontend/src/app.js` to app composition instead of app composition plus lifecycle and persistence details.

Do:

- Extract shell action button setup.
- Extract session bootstrap/loading helpers.
- Extract teardown or app-lifecycle wiring if it still reads as one long flow.
- Keep `createApp()` as the main entrypoint.

Deliverables:

- Smaller `frontend/src/app.js`
- New app-level helper modules if needed

Verify:

- App startup still mounts all features correctly.
- File open/create flows still work.
- Tree persistence and window-size persistence still work.

Depends on:

- T06

### T08. Split `app.css` by feature area

Goal:

Reduce `frontend/src/styles/app.css` so style ownership follows feature boundaries more clearly.

Do:

- Move titlebar styles into a dedicated stylesheet.
- Move tree pane and shell panel styles into dedicated stylesheets.
- Move detail-surface styles into feature-specific stylesheets where that improves ownership.
- Keep shared tokens and true cross-cutting component styles in the existing shared files.

Deliverables:

- Smaller `frontend/src/styles/app.css`
- New files under `frontend/src/styles/` or `frontend/src/styles/components/`

Verify:

- The app still renders the same.
- Style ownership is clearer from file names.

Depends on:

- T07

## Follow-Up Task List

These tasks capture the remaining maintainability findings after T01-T08 were completed.

### T09. Reduce `treeState` to core tree/session state ownership

Goal:

Bring `frontend/src/lib/state/tree-state.js` below the project’s “conscious reason above 500 lines” threshold and narrow it to one clear ownership boundary.

Do:

- Extract expansion-state helpers and visible-node derivation if they can live together more cleanly.
- Extract tree load/refresh and UI-state restore/persistence helpers if they read more like workflows than state ownership.
- Keep `treeState` as the public facade only if that compatibility layer still earns its cost; otherwise simplify the export surface.
- Preserve the current external behavior for selection, expansion, loading, refresh, and persistence.

Deliverables:

- Smaller `frontend/src/lib/state/tree-state.js`
- New focused state-side helper modules if needed

Verify:

- `treeState` still reads primarily as signals, computed values, selectors, and actions.
- File load, refresh, selection pruning, ancestor expansion, and persistent UI restore still work.
- The main state file is below 500 lines or has a clearly defensible reason to remain above it.

Depends on:

- T08

### T10. Split `import-merge-dialog` into shell, preview rendering, and interaction wiring

Goal:

Reduce `frontend/src/lib/features/import-merge-dialog.js` to one dialog surface with clearer internal boundaries.

Do:

- Extract preview section/row shaping and rendering helpers.
- Extract modal shell creation if the DOM construction remains large.
- Extract dialog interaction wiring for focus, keyboard handling, and button actions if those blocks remain long.
- Keep `list()` for keyed preview sections and rows where it still improves incremental updates.

Deliverables:

- Smaller `frontend/src/lib/features/import-merge-dialog.js`
- New import-merge dialog helper modules if needed

Verify:

- Open, close, focus trap, escape handling, and apply shortcut behavior still work.
- Preview loading, preview stats, and preview sections still render correctly.
- The remaining main dialog file is easier to scan and no longer mixes row rendering, shell creation, and interaction wiring inline.

Depends on:

- T09
- `app.css` acts as an import hub, not the main home for feature styling.

Depends on:

- T07
