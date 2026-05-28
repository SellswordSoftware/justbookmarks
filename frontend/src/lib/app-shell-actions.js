// @ts-check

import { createAddBookmarkForm } from "./features/add-bookmark-form.js";
import { createAddFolderForm } from "./features/add-folder-form.js";

/**
 * @typedef {object} AppShellActionsShell
 * @property {HTMLElement} toolbarActions
 * @property {HTMLElement} treePaneActions
 */

/**
 * @param {AppShellActionsShell} shell
 * @param {string} label
 * @param {() => void | Promise<void>} onClick
 * @returns {HTMLButtonElement}
 */
function createToolbarButton(shell, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-ghost btn-sm";
  button.textContent = label;
  button.addEventListener("click", () => {
    void onClick();
  });
  shell.toolbarActions.append(button);
  return button;
}

/**
 * @param {HTMLElement} wrapper
 * @param {string} label
 * @param {string} iconClassName
 * @returns {void}
 */
function initializeTreeHeaderAction(wrapper, label, iconClassName) {
  const button = wrapper.querySelector("button");
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Expected root action trigger button");
  }

  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = "";

  const icon = document.createElement("span");
  icon.className = iconClassName;
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
}

/**
 * @param {AppShellActionsShell} shell
 * @param {{ openFile: () => Promise<void>, createFile: () => Promise<void> }} actions
 * @returns {void}
 */
export function renderShellPlaceholder(shell, actions) {
  shell.toolbarActions.replaceChildren();

  createToolbarButton(shell, "Open File", actions.openFile);
  createToolbarButton(shell, "Create File", actions.createFile);
}

/**
 * @param {AppShellActionsShell} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountRootTreeActions(shell) {
  const rootAddBookmark = createAddBookmarkForm({
    triggerLabel: "",
    formTitle: "Create bookmark at root",
    triggerClassName: "btn btn-ghost btn-sm btn-square tree-pane__action-btn tree-pane__action-btn--bookmark",
    triggerKeyboardAction: "root-add-bookmark",
    getParentFolderId: () => "",
  });
  const rootAddFolder = createAddFolderForm({
    triggerLabel: "",
    formTitle: "Create folder at root",
    triggerClassName: "btn btn-ghost btn-sm btn-square tree-pane__action-btn tree-pane__action-btn--folder",
    triggerKeyboardAction: "root-add-folder",
    getParentFolderId: () => "",
  });

  initializeTreeHeaderAction(
    rootAddBookmark.element,
    "New bookmark",
    "tree-pane__action-icon tree-pane__action-icon--bookmark",
  );
  initializeTreeHeaderAction(
    rootAddFolder.element,
    "New folder",
    "tree-pane__action-icon tree-pane__action-icon--folder",
  );

  shell.treePaneActions.append(rootAddBookmark.element, rootAddFolder.element);

  return {
    cleanup() {
      rootAddBookmark.cleanup();
      rootAddFolder.cleanup();
    },
  };
}
