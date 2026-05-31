// @ts-check

import { mountAppLifecycle } from "./lifecycle.js";
import { bootstrapSession } from "./session.js";
import { collectConfirmModalShell, mountConfirmModal } from "../components/confirm-modal/confirm-modal.js";
import { collectLayoutShell, mountLayout } from "../layouts/app-shell/app-shell-layout.js";
import { collectMoveDialogShell, mountMoveDialog } from "../features/move/move-dialog.js";
import {
  collectKeyboardShortcutsDialogShell,
  mountKeyboardShortcutsDialog,
} from "../components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js";
import {
  collectImportMergeDialogShell,
  mountImportMergeDialog,
} from "../features/import-merge/import-merge-dialog.js";
import { collectToastContainerShell, mountToastContainer } from "../components/toast/toast-container.js";
import { collectTitlebarShell, mountTitlebar } from "../components/titlebar/titlebar.js";
import { mountPageHost } from "./page-host.js";

/**
 * @typedef {object} AppShell
 * @property {HTMLElement} root
 * @property {HTMLElement} titlebar
 * @property {HTMLElement} titlebarMeta
 * @property {HTMLElement} appToolbar
 * @property {HTMLElement} mainContent
 * @property {HTMLElement} treePane
 * @property {HTMLElement} detailPane
 * @property {HTMLButtonElement} paneResizer
 * @property {HTMLInputElement} searchInput
 * @property {HTMLElement} treePaneContent
 * @property {HTMLElement} treeList
 * @property {HTMLElement} treePaneMeta
 * @property {HTMLElement} treePaneActions
 * @property {HTMLElement} detailPaneContent
 * @property {HTMLElement} detailPaneMeta
 * @property {HTMLElement} toolbarActions
 * @property {HTMLElement} toastContainer
 * @property {HTMLElement} confirmModalContainer
 * @property {HTMLElement} moveDialogContainer
 * @property {HTMLElement} importMergeDialogContainer
 * @property {HTMLElement} keyboardShortcutsDialogContainer
 */

/**
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {HTMLElement}
 */
function requireElement(root, selector) {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Expected element for selector: ${selector}`);
  }
  return el;
}

/**
 * Collect the stable shell containers future modules bind into.
 *
 * @param {HTMLElement} root
 * @returns {AppShell}
 */
function collectShell(root) {
  const searchInput = root.querySelector("#search-input");
  if (!(searchInput instanceof HTMLInputElement)) {
    throw new Error("Expected #search-input to be an input element");
  }

  return {
    root,
    titlebar: requireElement(root, "#titlebar"),
    titlebarMeta: requireElement(root, "#titlebar-meta"),
    appToolbar: requireElement(root, ".app-toolbar"),
    mainContent: requireElement(root, "#main-content"),
    treePane: requireElement(root, "#tree-pane"),
    detailPane: requireElement(root, "#detail-pane"),
    paneResizer: /** @type {HTMLButtonElement} */ (requireElement(root, "#pane-resizer")),
    searchInput,
    treePaneContent: requireElement(root, "#tree-pane-content"),
    treeList: requireElement(root, "#tree-list"),
    treePaneMeta: requireElement(root, "#tree-pane-meta"),
    treePaneActions: requireElement(root, "#tree-pane-actions"),
    detailPaneContent: requireElement(root, "#detail-pane-content"),
    detailPaneMeta: requireElement(root, "#detail-pane-meta"),
    toolbarActions: requireElement(root, "#toolbar-actions"),
    toastContainer: requireElement(root, "#toast-container"),
    confirmModalContainer: requireElement(root, "#confirm-modal-container"),
    moveDialogContainer: requireElement(root, "#move-dialog-container"),
    importMergeDialogContainer: requireElement(root, "#import-merge-dialog-container"),
    keyboardShortcutsDialogContainer: requireElement(root, "#keyboard-shortcuts-dialog-container"),
  };
}

/**
 * Bootstrap the HTML-first shell.
 *
 * @param {HTMLElement} root
 * @returns {AppShell}
 */
export function createApp(root) {
  const cleanupTitlebar = mountTitlebar(collectTitlebarShell(root));
  const shell = collectShell(root);
  const cleanupLayout = mountLayout(collectLayoutShell(root));
  const toastContainer = mountToastContainer(collectToastContainerShell(root));
  const confirmModal = mountConfirmModal(collectConfirmModalShell(root));
  const importMergeDialog = mountImportMergeDialog(collectImportMergeDialogShell(root));
  const moveDialog = mountMoveDialog(collectMoveDialogShell(root));
  const shortcutsDialog = mountKeyboardShortcutsDialog(
    collectKeyboardShortcutsDialogShell(root),
  );
  const pageHost = mountPageHost(shell);
  const lifecycle = mountAppLifecycle({
    featureCleanups: [
      { cleanup: cleanupTitlebar },
      { cleanup: cleanupLayout },
      toastContainer,
      confirmModal,
      importMergeDialog,
      moveDialog,
      shortcutsDialog,
      pageHost,
    ],
  });
  void bootstrapSession();
  void lifecycle;
  return shell;
}
