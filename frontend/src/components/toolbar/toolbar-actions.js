// @ts-check

import {
  attr,
  cleanupCollector,
  mount,
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
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createToolbarActionsComponent(actions) {
  const cleanup = cleanupCollector();
  const renderToolbarActions =
    /** @type {TemplateTag} */ (
      template({
        root: ".toolbar-actions-runtime",
        onMount(el, _parent, ctx) {
          if (!(el instanceof HTMLElement)) {
            throw new Error("Expected toolbar actions root");
          }

          const openButton = ctx.refs.openButton;
          const createButton = ctx.refs.createButton;
          const importButton = ctx.refs.importButton;

          if (!(openButton instanceof HTMLButtonElement)) {
            throw new Error("Expected open toolbar button");
          }
          if (!(createButton instanceof HTMLButtonElement)) {
            throw new Error("Expected create toolbar button");
          }
          if (!(importButton instanceof HTMLButtonElement)) {
            throw new Error("Expected import toolbar button");
          }

          const handleOpenClick = () => {
            void actions.openFile();
          };
          const handleCreateClick = () => {
            void actions.createFile();
          };
          const handleImportClick = () => {
            void actions.importFile();
          };

          openButton.addEventListener("click", handleOpenClick);
          createButton.addEventListener("click", handleCreateClick);
          importButton.addEventListener("click", handleImportClick);

          cleanup.add(
            () => openButton.removeEventListener("click", handleOpenClick),
            () => createButton.removeEventListener("click", handleCreateClick),
            () => importButton.removeEventListener("click", handleImportClick),
            attr(importButton, "disabled", () => !appState.currentFilePath()),
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
        class="btn btn-ghost btn-sm"
        data-toolbar-action="open"
        data-ref="openButton"
      >
        Open File
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-toolbar-action="create"
        data-ref="createButton"
      >
        Create File
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-toolbar-action="import"
        data-ref="importButton"
      >
        Import File
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
