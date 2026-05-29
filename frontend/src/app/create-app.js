// @ts-check

import { effect } from "../shared/runtime/naf-html.js";
import { mountAppLifecycle } from "./lifecycle.js";
import { bootstrapSession, createFile, openFile } from "./session.js";
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
import { mountEmptyLibraryPage } from "../pages/empty-library/empty-library-page.js";
import { mountLibraryPage } from "../pages/library/library-page.js";
import { treeState } from "../features/tree/state/tree-state.js";
import { appState } from "../shared/state/app-state.js";

/** @typedef {import("../types.js").TreeNode} TreeNode */

/**
 * @typedef {object} AppShell
 * @property {HTMLElement} root
 * @property {HTMLElement} titlebar
 * @property {HTMLElement} titlebarMeta
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
 * @property {HTMLTemplateElement} treeNodeTemplate
 * @property {HTMLTemplateElement} searchResultTemplate
 * @property {HTMLTemplateElement} toastTemplate
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
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {HTMLTemplateElement}
 */
function requireTemplate(root, selector) {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLTemplateElement)) {
    throw new Error(`Expected template for selector: ${selector}`);
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
    treeNodeTemplate: requireTemplate(root, "#tree-node-template"),
    searchResultTemplate: requireTemplate(root, "#search-result-template"),
    toastTemplate: requireTemplate(root, "#toast-template"),
  };
}

/**
 * @param {AppShell} shell
 * @returns {{ cleanup: () => void }}
 */
function mountPageSelection(shell) {
  let currentPage = /** @type {{ cleanup: () => void }} */ ({
    cleanup() {},
  });
  let currentPageKind = "empty";

  const pageActions = {
    openFile: () => openFile(shell),
    createFile: () => createFile(shell),
    importFile: () => appState.actions.openImportMerge(),
  };

  const stop = effect(() => {
    const filePath = appState.selectors.getCurrentFilePath();
    const loading = treeState.selectors.isLoading();
    const shouldKeepLibraryPage =
      currentPageKind === "library" &&
      !filePath &&
      !loading &&
      treeState.selectors.getTree().length > 0;
    const nextPageKind =
      filePath || loading || shouldKeepLibraryPage ? "library" : "empty";

    if (nextPageKind === currentPageKind) {
      return;
    }

    currentPage.cleanup();
    currentPageKind = nextPageKind;
    currentPage =
      currentPageKind === "library"
        ? mountLibraryPage(shell, pageActions)
        : mountEmptyLibraryPage(shell, pageActions);
  });

  currentPage = mountEmptyLibraryPage(shell, pageActions);

  return {
    cleanup() {
      stop();
    },
  };
}

/**
 * Bootstrap the HTML-first shell.
 *
 * @param {HTMLElement} root
 * @returns {AppShell}
 */
export function createApp(root) {
  const shell = collectShell(root);
  const cleanupTitlebar = mountTitlebar(collectTitlebarShell(root));
  const cleanupLayout = mountLayout(collectLayoutShell(root));
  const toastContainer = mountToastContainer(collectToastContainerShell(root));
  const confirmModal = mountConfirmModal(collectConfirmModalShell(root));
  const importMergeDialog = mountImportMergeDialog(collectImportMergeDialogShell(root));
  const moveDialog = mountMoveDialog(collectMoveDialogShell(root));
  const shortcutsDialog = mountKeyboardShortcutsDialog(
    collectKeyboardShortcutsDialogShell(root),
  );
  const pageSelection = mountPageSelection(shell);
  const lifecycle = mountAppLifecycle({
    featureCleanups: [
      { cleanup: cleanupTitlebar },
      { cleanup: cleanupLayout },
      toastContainer,
      confirmModal,
      importMergeDialog,
      moveDialog,
      shortcutsDialog,
      pageSelection,
    ],
  });
  void bootstrapSession();
  void lifecycle;
  return shell;
}
