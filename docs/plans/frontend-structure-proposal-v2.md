# Frontend Structure Proposal V2

## Purpose

This proposal refines the current domain-first structure into a more transferable frontend model:

- `pages` for screen-level compositions
- `features` for behavior-rich product areas
- `components` for reusable contained UI units
- `layouts` for app shell and structural chrome
- `shared` for cross-cutting runtime, infra, API, and primitive styles

This is meant to work well for this app and also serve as a repeatable pattern for similar single-window vanilla frontend applications.

## Core Rule

Organize the frontend by abstraction level first:

1. `pages` compose visible screens
2. `features` own user-facing behavior
3. `components` provide reusable UI building blocks
4. `layouts` provide app shell structure
5. `shared` holds only true cross-app dependencies

Do not use `components` as a catch-all for feature logic. Do not use `shared` as a dumping ground for code that really belongs to one feature.

## Proposed Target Tree

```text
frontend/src/
  app/
    create-app.js
    lifecycle.js
    session.js

  pages/
    empty-library/
      empty-library-page.js
      empty-library-page.css
    library/
      library-page.js
      library-page.css

  features/
    tree/
      state/
        tree-state.js
        selection.js
        structure.js
        normalize.js
        expansion.js
        persistence.js
      view/
        bookmark-tree.js
        bookmark-tree-row.js
        bookmark-search-result-row.js
      interactions/
        bookmark-tree-keyboard.js
        bookmark-tree-dnd.js
      styles/
        tree-list.css
        tree-pane.css

    detail/
      view/
        detail-panel.js
        bookmark-detail.js
        bookmark-detail-shell.js
        folder-detail.js
        bulk-selection-detail.js
      actions/
        bookmark-detail-actions.js
        bookmark-detail-metadata.js
      styles/
        detail-surface.css

    search/
      state/
        search-state.js
      view/
        search-bar.js

    import-merge/
      import-merge-state.js
      import-merge-dialog.js
      import-merge-dialog-shell.js
      import-merge-dialog-preview.js
      import-merge-dialog-interactions.js

    move/
      move-dialog.js
      move-dialog-state.js

    editing/
      add-bookmark-form.js
      add-folder-form.js

    shortcuts/
      global-shortcuts.js
      global-shortcuts-focus.js
      global-shortcuts-history.js
      global-shortcuts-search.js
      global-shortcuts-tree-actions.js

  components/
    confirm-modal/
      confirm-modal.js
    keyboard-shortcuts-dialog/
      keyboard-shortcuts-dialog.js
    toast/
      toast-container.js
    titlebar/
      titlebar.js
      titlebar.css
    toolbar/
      toolbar-actions.js
      toolbar.css
    shell-panel/
      shell-panel.css
    empty-state/
      empty-state-card.js
      empty-state-card.css

  layouts/
    app-shell/
      app-shell-layout.js
      app-shell-layout.css
      pane-resizer.js

  shared/
    api/
      api.js
    infra/
      errors.js
      focus.js
      persistence.js
    runtime/
      naf-html.js
    state/
      app-state.js
      ui-state.js
    styles/
      alert.css
      badge.css
      button.css
      card.css
      form.css
      menu.css
      modal.css
      spinner.css
      dialogs-extra.css

  styles/
    app.css
    reset.css
    tokens.css
    base.css
    themes/
      light.css
      dark.css
```

## Mental Model

### `app/`

Owns bootstrap and lifecycle only:

- app startup
- session bootstrap and file restore
- lifecycle teardown and persistence wiring

`app/` should compose the app, not become the place where feature logic accumulates.

### `pages/`

Owns screen-level composition.

For this app, pages are still useful even though there is one product window:

- `empty-library`
  - what the user sees when no bookmark file is open
- `library`
  - the main loaded-file experience

If another top-level app state appears later, it should usually start as a page instead of being folded into `app/`.

### `features/`

Owns behavior-rich product areas:

- tree behavior
- detail behavior
- search behavior
- import/merge workflow
- move workflow
- editing flows
- keyboard shortcuts

Features can contain state, DOM bindings, workflows, and interactions. They are not required to be reusable outside the app.

### `components/`

Owns reusable, bounded UI units.

Good candidates:

- titlebar
- confirm modal
- keyboard shortcuts dialog
- toast container
- toolbar action strip
- empty-state cards

These may have local state and interactions, but they should not own broad app workflows.

### `layouts/`

Owns structural shell composition:

- pane layout
- resizer behavior
- app shell chrome

This is the missing concept between pages and components. Without it, shell-level structure tends to leak into either `app/` or a vague chrome feature bucket.

### `shared/`

Owns only cross-feature dependencies:

- API bridge
- persistence
- focus helpers
- runtime primitives
- app-global state
- primitive reusable styles

If a module mostly serves one feature, keep it with that feature.

## Current To Proposed Mapping

### App

- `frontend/src/app/create-app.js` -> `frontend/src/app/create-app.js`
- `frontend/src/app/lifecycle.js` -> `frontend/src/app/lifecycle.js`
- `frontend/src/app/session.js` -> `frontend/src/app/session.js`
- `frontend/src/app/shell-actions.js` -> `frontend/src/components/toolbar/toolbar-actions.js`

### Pages

These do not exist yet and should be introduced as real composition boundaries:

- `frontend/src/pages/empty-library/empty-library-page.js`
- `frontend/src/pages/library/library-page.js`

Likely extraction sources:

- loaded-file composition currently in `frontend/src/app/create-app.js`
- no-file placeholder and shell status logic currently in `frontend/src/app/create-app.js`

### Tree Feature

- `frontend/src/domains/tree/state/*` -> `frontend/src/features/tree/state/*`
- `frontend/src/domains/tree/view/*` -> `frontend/src/features/tree/view/*`
- `frontend/src/domains/tree/interactions/*` -> `frontend/src/features/tree/interactions/*`
- `frontend/src/domains/tree/styles/*` -> `frontend/src/features/tree/styles/*`

### Detail Feature

- `frontend/src/domains/detail/view/*` -> `frontend/src/features/detail/view/*`
- `frontend/src/domains/detail/actions/*` -> `frontend/src/features/detail/actions/*`
- `frontend/src/domains/detail/styles/*` -> `frontend/src/features/detail/styles/*`

### Search Feature

- `frontend/src/domains/search/state/*` -> `frontend/src/features/search/state/*`
- `frontend/src/domains/search/view/*` -> `frontend/src/features/search/view/*`

### Import/Merge Feature

- `frontend/src/domains/dialogs/import-merge/import-merge-state.js` -> `frontend/src/features/import-merge/import-merge-state.js`
- `frontend/src/domains/dialogs/import-merge/import-merge-dialog.js` -> `frontend/src/features/import-merge/import-merge-dialog.js`
- `frontend/src/domains/dialogs/import-merge/import-merge-dialog-shell.js` -> `frontend/src/features/import-merge/import-merge-dialog-shell.js`
- `frontend/src/domains/dialogs/import-merge/import-merge-dialog-preview.js` -> `frontend/src/features/import-merge/import-merge-dialog-preview.js`
- `frontend/src/domains/dialogs/import-merge/import-merge-dialog-interactions.js` -> `frontend/src/features/import-merge/import-merge-dialog-interactions.js`

### Move Feature

- `frontend/src/domains/dialogs/move/move-dialog.js` -> `frontend/src/features/move/move-dialog.js`
- `frontend/src/domains/dialogs/move/move-dialog-state.js` -> `frontend/src/features/move/move-dialog-state.js`

### Editing Feature

- `frontend/src/domains/editing/add-bookmark-form.js` -> `frontend/src/features/editing/add-bookmark-form.js`
- `frontend/src/domains/editing/add-folder-form.js` -> `frontend/src/features/editing/add-folder-form.js`

### Shortcuts Feature

- `frontend/src/domains/shortcuts/*` -> `frontend/src/features/shortcuts/*`

### Components

- `frontend/src/domains/dialogs/confirm/confirm-modal.js` -> `frontend/src/components/confirm-modal/confirm-modal.js`
- `frontend/src/domains/dialogs/keyboard-shortcuts/keyboard-shortcuts-dialog.js` -> `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js`
- `frontend/src/domains/chrome/toast-container.js` -> `frontend/src/components/toast/toast-container.js`
- `frontend/src/domains/chrome/titlebar.js` -> `frontend/src/components/titlebar/titlebar.js`
- `frontend/src/domains/chrome/styles/titlebar.css` -> `frontend/src/components/titlebar/titlebar.css`
- `frontend/src/domains/chrome/styles/toolbar.css` -> `frontend/src/components/toolbar/toolbar.css`
- `frontend/src/domains/chrome/styles/shell-panel.css` -> `frontend/src/components/shell-panel/shell-panel.css`

### Layouts

- `frontend/src/domains/chrome/layout.js` -> `frontend/src/layouts/app-shell/app-shell-layout.js`
- `frontend/src/styles/layout.css` -> keep in `frontend/src/styles/layout.css` if it remains global, or move page-shell-specific layout rules into `frontend/src/layouts/app-shell/app-shell-layout.css`

## What Is Intentionally Missing

This proposal does not create extra folders for:

- `hooks`
- `services`
- `utils`
- `stores`

Those names are too generic and usually become dumping grounds.

If a file is added, it should usually have a clear home in:

- `page`
- `feature`
- `component`
- `layout`
- `shared`

## Recommended Adoption Order

1. Rename `domains/` to `features/`
2. Introduce `components/` for reusable UI units now living under `dialogs/` and `chrome/`
3. Introduce `layouts/` and move app shell structure there
4. Add real `pages/` for empty-library and loaded-library composition
5. Leave `shared/` and `styles/` as they are unless a file clearly belongs elsewhere

## Practical Rule Of Thumb

When adding a new file, ask these in order:

1. Is this a whole screen composition? Put it in `pages/`.
2. Is this a behavior-rich app area? Put it in `features/`.
3. Is this a reusable contained UI unit? Put it in `components/`.
4. Is this structural shell composition? Put it in `layouts/`.
5. Is this truly cross-feature? Put it in `shared/`.

If none of those answers cleanly fit, the design boundary probably needs another pass before adding the file.
