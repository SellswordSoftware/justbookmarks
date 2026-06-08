// @ts-check

import {
  attr,
  cleanupCollector,
  listener,
  mount,
  requireRef,
  template,
} from "../../shared/runtime/naf.js";
import { appState } from "../../shared/state/app-state.js";
import { createAddBookmarkForm } from "../../features/editing/add-bookmark-form.js";
import { createAddFolderForm } from "../../features/editing/add-folder-form.js";

/**
 * @typedef {object} AppShellActionsShell
 * @property {HTMLElement} toolbarActions
 * @property {HTMLElement} treePaneActions
 */

/**
 * @param {{
 *   openFile: () => Promise<void>,
 *   createFile: () => Promise<void>,
 *   importFile: () => Promise<void>
 * }} actions
 * @returns {Component<HTMLElement>}
 */
function createToolbarActionsComponent(actions) {
  const cleanup = cleanupCollector();
  const renderToolbarActions =
    /** @type {TemplateTag} */ (
      template({
        root: ".toolbar-actions-runtime",
        onMount(_el, _parent, ctx) {
          const openButton = /** @type {HTMLButtonElement} */ (requireRef(ctx.refs, "openButton"));
          const createButton = /** @type {HTMLButtonElement} */ (requireRef(ctx.refs, "createButton"));
          const importButton = /** @type {HTMLButtonElement} */ (requireRef(ctx.refs, "importButton"));

          const handleOpenClick = () => {
            void actions.openFile();
          };
          const handleCreateClick = () => {
            void actions.createFile();
          };
          const handleImportClick = () => {
            void actions.importFile();
          };

          cleanup.add(
            listener(openButton, "click", handleOpenClick),
            listener(createButton, "click", handleCreateClick),
            listener(importButton, "click", handleImportClick),
            attr(importButton, "disabled", () => !appState.selectors.getCurrentFilePath()),
          );
        },
        onUnmount() {
          cleanup.run();
        },
      })
    );

  return renderToolbarActions /*html*/ `
    <div class="toolbar-actions-runtime">
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square toolbar-action-btn"
        data-toolbar-action="open"
        data-ref="openButton"
        aria-label="Open bookmark file"
        title="Open bookmark file"
      >
        <span class="icon-mask toolbar-action-icon toolbar-action-icon--open" aria-hidden="true"></span>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square toolbar-action-btn"
        data-toolbar-action="create"
        data-ref="createButton"
        aria-label="Create bookmark file"
        title="Create bookmark file"
      >
        <span class="icon-mask toolbar-action-icon toolbar-action-icon--create" aria-hidden="true"></span>
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square toolbar-action-btn"
        data-toolbar-action="import"
        data-ref="importButton"
        aria-label="Import another bookmark file into the current library"
        title="Import another bookmark file into the current library"
      >
        <span class="icon-mask toolbar-action-icon toolbar-action-icon--import" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

/**
 * @param {AppShellActionsShell} shell
 * @param {{
 *   openFile: () => Promise<void>,
 *   createFile: () => Promise<void>,
 *   importFile: () => Promise<void>
 * }} actions
 * @returns {{ cleanup: () => void }}
 */
export function mountToolbarActions(shell, actions) {
  const component = createToolbarActionsComponent(actions);
  mount(component, shell.toolbarActions);

  return {
    cleanup() {
      component.unmount?.();
      shell.toolbarActions.replaceChildren();
    },
  };
}

/**
 * @param {AppShellActionsShell} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountRootTreeActions(shell) {
  const rootAddBookmark = createAddBookmarkForm({
    triggerLabel: "",
    formTitle: "Create bookmark at root",
    triggerClassName:
      "btn btn-ghost btn-sm btn-square tree-pane__action-btn tree-pane__action-btn--bookmark",
    triggerKeyboardAction: "root-add-bookmark",
    triggerAriaLabel: "New bookmark",
    triggerTitle: "New bookmark",
    triggerIconClassName:
      "tree-pane__action-icon icon-mask tree-pane__action-icon--bookmark",
    getParentFolderId: () => "",
  });
  const rootAddFolder = createAddFolderForm({
    triggerLabel: "",
    formTitle: "Create folder at root",
    triggerClassName:
      "btn btn-ghost btn-sm btn-square tree-pane__action-btn tree-pane__action-btn--folder",
    triggerKeyboardAction: "root-add-folder",
    triggerAriaLabel: "New folder",
    triggerTitle: "New folder",
    triggerIconClassName:
      "tree-pane__action-icon icon-mask tree-pane__action-icon--folder",
    getParentFolderId: () => "",
  });
  const renderRootActions =
    /** @type {TemplateTag} */ (
      template
    );
  const rootActions = renderRootActions`
    ${rootAddBookmark}
    ${rootAddFolder}
  `;
  mount(rootActions, shell.treePaneActions);

  return {
    cleanup() {
      rootActions.unmount?.();
      shell.treePaneActions.replaceChildren();
    },
  };
}
