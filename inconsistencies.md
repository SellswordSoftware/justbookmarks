# Frontend `naf` Inconsistencies

Reference pattern: `frontend/src/shared/runtime/naf.js` provides `template()`, `mount()`, `list()`, `data-ref` collection, and component composition. `frontend/src/components/titlebar/titlebar.js` is the clearest example of the preferred style: declarative template markup, `data-ref` for element access, and lifecycle wiring in `onMount`.

## 1. Full UI fragments still built with direct `document.createElement`

These modules bypass `naf` components entirely and manually construct their DOM trees. They still use `signal`/`fx`/`model`, but the HTML itself is imperative rather than component-driven.

- `frontend/src/features/editing/add-bookmark-form.js:39` builds the full add-bookmark launcher/panel with `createElement`, manual `append`, and manual listener registration.
- `frontend/src/features/editing/add-folder-form.js:26` does the same for the add-folder launcher/panel.
- `frontend/src/features/detail/view/bookmark-detail-shell.js:38` builds the entire bookmark detail shell imperatively.
- `frontend/src/features/detail/view/folder-detail.js:28` builds the entire folder detail UI imperatively, then embeds the add-bookmark/add-folder imperative fragments inside it.
- `frontend/src/features/detail/view/bulk-selection-detail.js:29` builds the bulk selection panel imperatively.
- `frontend/src/features/detail/view/detail-panel.js:107` still creates the empty-state DOM imperatively instead of rendering a component.
- `frontend/src/features/tree/view/bookmark-tree.js:81` still creates tree empty states with `document.createElement`.

## 2. Mixed composition contract: `{ element, cleanup }` objects instead of `naf` components

Some UI producers return ad-hoc objects with `{ element, cleanup }` rather than `Component<T>`. That prevents consistent composition through `${childComponent}` and pushes parents back toward manual `append(...)`.

- `frontend/src/features/editing/add-bookmark-form.js:37`
- `frontend/src/features/editing/add-folder-form.js:24`
- `frontend/src/features/detail/view/folder-detail.js:26`
- `frontend/src/features/detail/view/bulk-selection-detail.js:27`
- `frontend/src/features/detail/view/detail-panel.js:69`
- `frontend/src/features/detail/view/bookmark-detail.js:19`

Concrete effects of this inconsistency:

- `frontend/src/components/toolbar/toolbar-actions.js:152` mounts root tree actions by appending raw elements instead of composing `naf` children.
- `frontend/src/features/detail/view/folder-detail.js:119` appends `addBookmark.element` and `addFolder.element` directly into the folder detail actions row.
- `frontend/src/features/detail/view/detail-panel.js:96` and `frontend/src/features/detail/view/detail-panel.js:128` append rendered elements directly into the detail panel.

## 3. `naf` list rendering still depends on raw `HTMLTemplateElement` strings

Several modules are using `naf.list(...)`, but the row/section markup is still defined with `document.createElement("template")` plus `innerHTML`, not `naf` components.

- `frontend/src/components/toast/toast-container.js:25` creates the toast row template with raw `innerHTML`.
- `frontend/src/features/move/move-dialog.js:28` creates move-target rows with a raw template.
- `frontend/src/features/import-merge/import-merge-dialog-preview.js:111` creates section rows with raw template HTML.
- `frontend/src/features/import-merge/import-merge-dialog-preview.js:123` creates preview rows with raw template HTML.
- `frontend/src/features/tree/view/bookmark-tree.js:20` depends on pre-existing shell `<template>` nodes collected from the document rather than component-local `naf` markup.

This is only a partial migration: reactivity is in `naf`, but the HTML definition still lives outside the component model.

## 4. Templated components still create throwaway host `<div>` wrappers before `mount(...)`

These are already using `template()`/`mount()`, but instead of mounting into the shell container directly or composing into a parent component, they create a disposable wrapper node first.

- `frontend/src/pages/page-frame.js:40` defines `createPageHost()` as `document.createElement("div")` + `append`.
- `frontend/src/pages/library/library-page.js:158` mounts a hidden runtime-anchor component into that extra host.
- `frontend/src/pages/empty-library/empty-library-page.js:162` does the same.
- `frontend/src/components/confirm-modal/confirm-modal.js:154` creates a host `<div>` before mounting the modal.
- `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js:227` creates a host `<div>` before mounting the dialog.
- `frontend/src/features/import-merge/import-merge-dialog.js:194` creates a host `<div>` before mounting the dialog.
- `frontend/src/features/move/move-dialog.js:220` creates a host `<div>` before mounting the dialog.

This is inconsistent with the titlebar pattern, where the component mounts directly into the intended shell container.

## 5. Some `naf` templates interpolate raw HTML strings instead of composing components or setting text via refs

`naf`'s `buildTemplate()` currently inserts string values without escaping. That means string interpolation inside template markup is not equivalent to `textContent`; it is raw HTML injection.

High-risk dynamic cases:

- `frontend/src/components/confirm-modal/confirm-modal.js:110` interpolates `modal.title`.
- `frontend/src/components/confirm-modal/confirm-modal.js:111` interpolates `modal.message`.
- `frontend/src/components/confirm-modal/confirm-modal.js:128` interpolates `modal.confirmLabel`.
- `frontend/src/features/move/move-dialog.js:147` interpolates `view.label`.
- `frontend/src/features/import-merge/import-merge-dialog.js:47` interpolates `view.error`.
- `frontend/src/features/import-merge/import-merge-dialog.js:130` interpolates `view.importPath`.

Lower-risk but same pattern:

- `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js:83` and `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js:179` build large HTML strings (`groupsHtml`) and inject them into the component.
- `frontend/src/features/move/move-dialog.js:95` injects `emptyStateHtml`.
- `frontend/src/features/import-merge/import-merge-dialog.js:44` injects `errorHtml`.

This is more than a style inconsistency. It means different parts of the codebase treat “render text” differently:

- imperative modules mostly use `textContent`, which is safe by default
- templated modules sometimes inject strings as raw HTML

## 6. Attribute/state updates are split between declarative markup and post-mount mutation

The preferred `titlebar` style already does some post-mount mutation, but several modules lean heavily on it instead of keeping markup and state binding local and consistent.

- `frontend/src/components/toolbar/toolbar-actions.js:20` creates toolbar icons by clearing button text and appending a new `<span>` after render.
- `frontend/src/pages/empty-library/empty-library-page.js:42` mutates button label text in place for busy state.
- `frontend/src/features/move/move-dialog.js:178` toggles `disabled` by interpolating raw attribute strings into the template.
- `frontend/src/features/import-merge/import-merge-dialog.js:137`, `150`, `159` also toggle `disabled` through raw attribute-string interpolation.

The inconsistency is not that mutation exists, but that the project currently mixes:

- ref-based state mutation
- raw string-based attribute injection
- imperative DOM construction

instead of one predictable `naf` binding style.

## 7. Element lookup style is inconsistent inside rendered UI

The newer `naf` component style favors `data-ref` and `ctx.refs`. Older or partially migrated modules still query by CSS selectors after render.

- Good reference: `frontend/src/components/titlebar/titlebar.js:50` through `frontend/src/components/titlebar/titlebar.js:88` uses `ctx.refs.*`.
- `frontend/src/components/toast/toast-container.js:74` queries `[data-part="..."]` inside each row.
- `frontend/src/features/move/move-dialog.js:320` queries `.move-dialog__option-name` and `.move-dialog__option-path` inside each option row.
- `frontend/src/features/import-merge/import-merge-dialog-preview.js:141` and `173` query row internals by class name.
- `frontend/src/features/tree/view/bookmark-tree-row.js:43` and `frontend/src/features/tree/view/bookmark-search-result-row.js:15` query nested elements by selector instead of refs.

This means the codebase currently has at least three element-access conventions in active use:

- `ctx.refs` / `data-ref`
- local `querySelector(...)`
- shell collectors querying global/static containers

The third is fine for stable shell nodes; the first two are where the inconsistency lives.

## 8. Summary of modules that are already close vs. far from the preferred style

Closest to preferred `naf` component style:

- `frontend/src/components/titlebar/titlebar.js`
- `frontend/src/pages/empty-library/empty-library-page.js`
- `frontend/src/components/confirm-modal/confirm-modal.js`
- `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js`
- `frontend/src/features/import-merge/import-merge-dialog.js`
- `frontend/src/features/move/move-dialog.js`

Still partially inconsistent even in those modules:

- extra host wrapper nodes before `mount(...)`
- raw string interpolation into templates
- raw `HTMLTemplateElement` usage for repeated child rows

Farthest from the preferred style:

- `frontend/src/features/editing/add-bookmark-form.js`
- `frontend/src/features/editing/add-folder-form.js`
- `frontend/src/features/detail/view/bookmark-detail-shell.js`
- `frontend/src/features/detail/view/folder-detail.js`
- `frontend/src/features/detail/view/bulk-selection-detail.js`
- `frontend/src/features/detail/view/detail-panel.js`
- `frontend/src/components/toast/toast-container.js`
- `frontend/src/features/import-merge/import-merge-dialog-preview.js`

## Migration priority

If the goal is “prefer `naf` components over any direct DOM `createElement`”, the highest-value order is:

1. Convert the full imperative UI builders in `features/editing/*` and `features/detail/view/*` to real `naf` components.
2. Replace raw string interpolation in `confirm-modal`, `move-dialog`, and `import-merge-dialog`; those are correctness issues, not just style issues.
3. Replace raw list templates in `toast-container`, `move-dialog`, `import-merge-dialog-preview`, and tree row rendering with component-local `naf` markup plus refs.
4. Remove extra host wrapper `<div>` usage where components can mount directly into the real shell container.
