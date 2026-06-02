// @ts-check

import { requireElement } from "../shared/runtime/naf.js";
import { mountAppLifecycle } from "./lifecycle.js";
import { bootstrapSession } from "./session.js";
import { mountConfirmModal } from "../components/confirm-modal/confirm-modal.js";
import { mountLayout } from "../layouts/app-shell/app-shell-layout.js";
import { mountMoveDialog } from "../features/move/move-dialog.js";
import {
  mountKeyboardShortcutsDialog,
} from "../components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js";
import {
  mountImportMergeDialog,
} from "../features/import-merge/import-merge-dialog.js";
import { mountToastContainer } from "../components/toast/toast-container.js";
import { mountTitlebar } from "../components/titlebar/titlebar.js";
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
 * Collect the stable shell containers future modules bind into.
 *
 * @param {HTMLElement} root
 * @returns {AppShell}
 */
function collectShell(root) {
  return {
    root,
    titlebar: requireElement(root, "#titlebar", "titlebar"),
    titlebarMeta: requireElement(root, "#titlebar-meta", "titlebar-meta"),
    appToolbar: requireElement(root, ".app-toolbar", "app-toolbar"),
    mainContent: requireElement(root, "#main-content", "main-content"),
    treePane: requireElement(root, "#tree-pane", "tree-pane"),
    detailPane: requireElement(root, "#detail-pane", "detail-pane"),
    paneResizer: /** @type {HTMLButtonElement} */ (requireElement(root, "#pane-resizer", "pane-resizer")),
    searchInput: /** @type {HTMLInputElement} */ (requireElement(root, "#search-input", "search-input")),
    treePaneContent: requireElement(root, "#tree-pane-content", "tree-pane-content"),
    treeList: requireElement(root, "#tree-list", "tree-list"),
    treePaneMeta: requireElement(root, "#tree-pane-meta", "tree-pane-meta"),
    treePaneActions: requireElement(root, "#tree-pane-actions", "tree-pane-actions"),
    detailPaneContent: requireElement(root, "#detail-pane-content", "detail-pane-content"),
    detailPaneMeta: requireElement(root, "#detail-pane-meta", "detail-pane-meta"),
    toolbarActions: requireElement(root, "#toolbar-actions", "toolbar-actions"),
    toastContainer: requireElement(root, "#toast-container", "toast-container"),
    confirmModalContainer: requireElement(root, "#confirm-modal-container", "confirm-modal-container"),
    moveDialogContainer: requireElement(root, "#move-dialog-container", "move-dialog-container"),
    importMergeDialogContainer: requireElement(root, "#import-merge-dialog-container", "import-merge-dialog-container"),
    keyboardShortcutsDialogContainer: requireElement(root, "#keyboard-shortcuts-dialog-container", "keyboard-shortcuts-dialog-container"),
  };
}

/**
 * Bootstrap the HTML-first shell.
 *
 * @param {HTMLElement} root
 * @returns {AppShell}
 */
export function createApp(root) {
  const cleanupTitlebar = mountTitlebar(root);
  const shell = collectShell(root);
  const cleanupLayout = mountLayout(root);
  const toastContainer = mountToastContainer(root);
  const confirmModal = mountConfirmModal(root);
  const importMergeDialog = mountImportMergeDialog(root);
  const moveDialog = mountMoveDialog(root);
  const shortcutsDialog = mountKeyboardShortcutsDialog(root);
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
