# Frontend Structure Proposal

## Purpose

This proposal defines a clearer, domain-first folder structure for the vanilla frontend.

The goal is to make the codebase easier to navigate by answering the first question a developer usually has:

- "What part of the app am I changing?"

before forcing the second question:

- "Is this state, view, interaction, or infrastructure code?"

## Core Rule

Organize the frontend primarily by domain or app area.

Within a domain, split by concern only as needed:

- `state`
- `view`
- `interactions`
- `actions`
- `styles`

Keep only truly cross-domain code outside domain folders.

## Proposed Target Tree

```text
frontend/src/
  app/
    create-app.js
    lifecycle.js
    session.js
    shell-actions.js

  domains/
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

    dialogs/
      confirm/
        confirm-modal.js
      move/
        move-dialog.js
        move-dialog-state.js
      import-merge/
        import-merge-dialog.js
        import-merge-dialog-shell.js
        import-merge-dialog-preview.js
        import-merge-dialog-interactions.js
        import-merge-state.js
      keyboard-shortcuts/
        keyboard-shortcuts-dialog.js

    shortcuts/
      global-shortcuts.js
      global-shortcuts-focus.js
      global-shortcuts-history.js
      global-shortcuts-search.js
      global-shortcuts-tree-actions.js

    chrome/
      titlebar.js
      layout.js
      toast-container.js
      styles/
        titlebar.css
        shell-panel.css
        toolbar.css
        toast.css

    editing/
      add-bookmark-form.js
      add-folder-form.js

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
    layout.css
    themes/
      light.css
      dark.css
```

## Why This Structure

### Primary navigation is by domain

If you are working on:

- tree rendering or selection, go to `domains/tree/`
- detail panel behavior, go to `domains/detail/`
- import or move dialogs, go to `domains/dialogs/`
- shell/layout/titlebar behavior, go to `domains/chrome/`

### State stays close to the domain it serves

This keeps tree state with tree behavior, dialog state with dialog behavior, and search state with search UI.

This is easier to scan than keeping all state in one top-level `state/` folder while all UI lives elsewhere.

### Shared code stays genuinely shared

Top-level shared code should be limited to:

- runtime helpers
- browser/app infrastructure
- API access
- app-global state
- reusable primitive styles

If a file is mostly for one domain, it should live under that domain.

## Guidance On `features/` vs `state/`

The current `features/` and `state/` split is defensible, but it should not be the top-level mental model.

Recommended rule:

- use domain folders as the primary structure
- use `state`, `view`, `interactions`, and `actions` only inside a domain

So instead of:

```text
lib/features/tree/...
lib/state/tree/...
```

prefer:

```text
domains/tree/view/...
domains/tree/state/...
domains/tree/interactions/...
```

That keeps separation of concerns without making developers classify files by technical layer before they can even find the relevant domain.

## Current To Proposed Mapping

### App

- `frontend/src/app.js` -> `frontend/src/app/create-app.js`
- `frontend/src/lib/app-lifecycle.js` -> `frontend/src/app/lifecycle.js`
- `frontend/src/lib/app-session.js` -> `frontend/src/app/session.js`
- `frontend/src/lib/app-shell-actions.js` -> `frontend/src/app/shell-actions.js`

### Tree Domain

- `frontend/src/lib/features/tree/bookmark-tree.js` -> `frontend/src/domains/tree/view/bookmark-tree.js`
- `frontend/src/lib/features/tree/bookmark-tree-row.js` -> `frontend/src/domains/tree/view/bookmark-tree-row.js`
- `frontend/src/lib/features/tree/bookmark-search-result-row.js` -> `frontend/src/domains/tree/view/bookmark-search-result-row.js`
- `frontend/src/lib/features/tree/bookmark-tree-keyboard.js` -> `frontend/src/domains/tree/interactions/bookmark-tree-keyboard.js`
- `frontend/src/lib/features/tree/bookmark-tree-dnd.js` -> `frontend/src/domains/tree/interactions/bookmark-tree-dnd.js`
- `frontend/src/lib/state/tree/tree-state.js` -> `frontend/src/domains/tree/state/tree-state.js`
- `frontend/src/lib/state/tree/selection.js` -> `frontend/src/domains/tree/state/selection.js`
- `frontend/src/lib/state/tree/structure.js` -> `frontend/src/domains/tree/state/structure.js`
- `frontend/src/lib/state/tree/normalize.js` -> `frontend/src/domains/tree/state/normalize.js`
- `frontend/src/lib/state/tree/expansion.js` -> `frontend/src/domains/tree/state/expansion.js`
- `frontend/src/lib/state/tree/persistence.js` -> `frontend/src/domains/tree/state/persistence.js`
- `frontend/src/styles/components/tree-list.css` -> `frontend/src/domains/tree/styles/tree-list.css`
- `frontend/src/styles/components/tree-pane.css` -> `frontend/src/domains/tree/styles/tree-pane.css`

### Detail Domain

- `frontend/src/lib/features/detail-panel.js` -> `frontend/src/domains/detail/view/detail-panel.js`
- `frontend/src/lib/features/bookmark-detail.js` -> `frontend/src/domains/detail/view/bookmark-detail.js`
- `frontend/src/lib/features/bookmark-detail-shell.js` -> `frontend/src/domains/detail/view/bookmark-detail-shell.js`
- `frontend/src/lib/features/folder-detail.js` -> `frontend/src/domains/detail/view/folder-detail.js`
- `frontend/src/lib/features/bulk-selection-detail.js` -> `frontend/src/domains/detail/view/bulk-selection-detail.js`
- `frontend/src/lib/features/bookmark-detail-actions.js` -> `frontend/src/domains/detail/actions/bookmark-detail-actions.js`
- `frontend/src/lib/features/bookmark-detail-metadata.js` -> `frontend/src/domains/detail/actions/bookmark-detail-metadata.js`
- `frontend/src/styles/components/detail-surface.css` -> `frontend/src/domains/detail/styles/detail-surface.css`

### Search Domain

- `frontend/src/lib/features/search-bar.js` -> `frontend/src/domains/search/view/search-bar.js`
- `frontend/src/lib/state/search-state.js` -> `frontend/src/domains/search/state/search-state.js`

### Dialogs Domain

- `frontend/src/lib/features/confirm-modal.js` -> `frontend/src/domains/dialogs/confirm/confirm-modal.js`
- `frontend/src/lib/features/move-dialog.js` -> `frontend/src/domains/dialogs/move/move-dialog.js`
- `frontend/src/lib/state/move-dialog-state.js` -> `frontend/src/domains/dialogs/move/move-dialog-state.js`
- `frontend/src/lib/features/import-merge-dialog.js` -> `frontend/src/domains/dialogs/import-merge/import-merge-dialog.js`
- `frontend/src/lib/features/import-merge-dialog-shell.js` -> `frontend/src/domains/dialogs/import-merge/import-merge-dialog-shell.js`
- `frontend/src/lib/features/import-merge-dialog-preview.js` -> `frontend/src/domains/dialogs/import-merge/import-merge-dialog-preview.js`
- `frontend/src/lib/features/import-merge-dialog-interactions.js` -> `frontend/src/domains/dialogs/import-merge/import-merge-dialog-interactions.js`
- `frontend/src/lib/state/import-merge-state.js` -> `frontend/src/domains/dialogs/import-merge/import-merge-state.js`
- `frontend/src/lib/features/keyboard-shortcuts-dialog.js` -> `frontend/src/domains/dialogs/keyboard-shortcuts/keyboard-shortcuts-dialog.js`

### Shortcuts Domain

- `frontend/src/lib/features/global-shortcuts.js` -> `frontend/src/domains/shortcuts/global-shortcuts.js`
- `frontend/src/lib/features/global-shortcuts-focus.js` -> `frontend/src/domains/shortcuts/global-shortcuts-focus.js`
- `frontend/src/lib/features/global-shortcuts-history.js` -> `frontend/src/domains/shortcuts/global-shortcuts-history.js`
- `frontend/src/lib/features/global-shortcuts-search.js` -> `frontend/src/domains/shortcuts/global-shortcuts-search.js`
- `frontend/src/lib/features/global-shortcuts-tree-actions.js` -> `frontend/src/domains/shortcuts/global-shortcuts-tree-actions.js`

### Chrome Domain

- `frontend/src/lib/features/titlebar.js` -> `frontend/src/domains/chrome/titlebar.js`
- `frontend/src/lib/features/layout.js` -> `frontend/src/domains/chrome/layout.js`
- `frontend/src/lib/features/toast-container.js` -> `frontend/src/domains/chrome/toast-container.js`
- `frontend/src/styles/components/titlebar.css` -> `frontend/src/domains/chrome/styles/titlebar.css`
- `frontend/src/styles/components/shell-panel.css` -> `frontend/src/domains/chrome/styles/shell-panel.css`
- `frontend/src/styles/components/toolbar.css` -> `frontend/src/domains/chrome/styles/toolbar.css`
- `frontend/src/styles/components/toast.css` -> `frontend/src/domains/chrome/styles/toast.css`

### Editing Domain

- `frontend/src/lib/features/add-bookmark-form.js` -> `frontend/src/domains/editing/add-bookmark-form.js`
- `frontend/src/lib/features/add-folder-form.js` -> `frontend/src/domains/editing/add-folder-form.js`

### Shared Runtime / Infrastructure

- `frontend/src/lib/naf-html.js` -> `frontend/src/shared/runtime/naf-html.js`
- `frontend/src/lib/api.js` -> `frontend/src/shared/api/api.js`
- `frontend/src/lib/errors.js` -> `frontend/src/shared/infra/errors.js`
- `frontend/src/lib/focus.js` -> `frontend/src/shared/infra/focus.js`
- `frontend/src/lib/persistence.js` -> `frontend/src/shared/infra/persistence.js`

### Shared State

- `frontend/src/lib/state/app-state.js` -> `frontend/src/shared/state/app-state.js`
- `frontend/src/lib/state/ui-state.js` -> `frontend/src/shared/state/ui-state.js`

### Shared Styles

- `frontend/src/styles/components/alert.css` -> `frontend/src/shared/styles/alert.css`
- `frontend/src/styles/components/badge.css` -> `frontend/src/shared/styles/badge.css`
- `frontend/src/styles/components/button.css` -> `frontend/src/shared/styles/button.css`
- `frontend/src/styles/components/card.css` -> `frontend/src/shared/styles/card.css`
- `frontend/src/styles/components/form.css` -> `frontend/src/shared/styles/form.css`
- `frontend/src/styles/components/menu.css` -> `frontend/src/shared/styles/menu.css`
- `frontend/src/styles/components/modal.css` -> `frontend/src/shared/styles/modal.css`
- `frontend/src/styles/components/spinner.css` -> `frontend/src/shared/styles/spinner.css`
- `frontend/src/styles/components/dialogs-extra.css` -> `frontend/src/shared/styles/dialogs-extra.css`

### Global Style Foundation

- `frontend/src/styles/app.css` -> `frontend/src/styles/app.css`
- `frontend/src/styles/reset.css` -> `frontend/src/styles/reset.css`
- `frontend/src/styles/tokens.css` -> `frontend/src/styles/tokens.css`
- `frontend/src/styles/base.css` -> `frontend/src/styles/base.css`
- `frontend/src/styles/layout.css` -> `frontend/src/styles/layout.css`
- `frontend/src/styles/themes/light.css` -> `frontend/src/styles/themes/light.css`
- `frontend/src/styles/themes/dark.css` -> `frontend/src/styles/themes/dark.css`

## Migration Rules

If this structure is adopted, use these rules consistently:

1. Start by choosing the domain.
2. Put state next to the domain unless it is app-global.
3. Keep DOM/render code in `view/`.
4. Keep keyboard, pointer, drag/drop, and focus behavior in `interactions/`.
5. Keep async mutation workflows in `actions/` when they are not just local event handlers.
6. Put styles with the domain they style unless they are primitive shared styles.
7. Avoid "misc" folders and vague filenames.

## Suggested Migration Order

1. Rename `lib/` to `shared/` and `domains/` plus `app/` in one dedicated structural pass.
2. Move tree, detail, search, and dialogs into domain folders.
3. Move styles to domain-owned locations.
4. Update imports without mixing behavioral refactors into the same pass.
5. Add a short architecture note to the repo so future files follow the same mental model.

## Bottom Line

The proposed structure keeps the good part of the current separation of concerns while making the codebase much easier to navigate:

- first by domain
- then by responsibility

That should produce a more consistent and more intuitive mental model for ongoing vanilla frontend development.
