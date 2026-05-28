// @ts-check

import { effect } from "./lib/naf-html.js";
import { mountAppLifecycle } from "./lib/app-lifecycle.js";
import { bootstrapSession, createFile, openFile } from "./lib/app-session.js";
import { mountRootTreeActions, renderShellPlaceholder } from "./lib/app-shell-actions.js";
import {
  collectBookmarkTreeShell,
  mountBookmarkTree,
} from "./lib/features/bookmark-tree.js";
import { collectConfirmModalShell, mountConfirmModal } from "./lib/features/confirm-modal.js";
import {
  collectDetailPanelShell,
  mountDetailPanel,
} from "./lib/features/detail-panel.js";
import { mountGlobalShortcuts } from "./lib/features/global-shortcuts.js";
import { collectLayoutShell, mountLayout } from "./lib/features/layout.js";
import { collectMoveDialogShell, mountMoveDialog } from "./lib/features/move-dialog.js";
import { collectSearchBarShell, mountSearchBar } from "./lib/features/search-bar.js";
import {
  collectKeyboardShortcutsDialogShell,
  mountKeyboardShortcutsDialog,
} from "./lib/features/keyboard-shortcuts-dialog.js";
import {
  collectImportMergeDialogShell,
  mountImportMergeDialog,
} from "./lib/features/import-merge-dialog.js";
import { collectToastContainerShell, mountToastContainer } from "./lib/features/toast-container.js";
import { collectTitlebarShell, mountTitlebar } from "./lib/features/titlebar.js";
import { treeState } from "./lib/state/tree-state.js";
import { appState } from "./lib/state/app-state.js";

/** @typedef {import("./types.js").TreeNode} TreeNode */

/**
 * @typedef {object} AppShell
 * @property {HTMLElement} root
 * @property {HTMLElement} titlebar
 * @property {HTMLElement} titlebarMeta
 * @property {HTMLInputElement} searchInput
 * @property {HTMLElement} treeList
 * @property {HTMLElement} treePaneMeta
 * @property {HTMLElement} treePaneActions
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
    treeList: requireElement(root, "#tree-list"),
    treePaneMeta: requireElement(root, "#tree-pane-meta"),
    treePaneActions: requireElement(root, "#tree-pane-actions"),
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
function mountShellStatus(shell) {
  const stop = effect(() => {
    const filePath = appState.selectors.getCurrentFilePath();
    const treeError = treeState.selectors.getError();
    const loading = treeState.selectors.isLoading();
    const hasAttemptedLoad = appState.selectors.hasTriedLoad();

    shell.titlebarMeta.textContent = treeError
      ? treeError
      : filePath || "Vanilla frontend shell active";

    if (!filePath && !loading && hasAttemptedLoad && !treeError) {
      shell.treePaneMeta.textContent = "No bookmark file is currently open";
    }
  });

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
  renderShellPlaceholder(shell, {
    openFile: () => openFile(shell),
    createFile: () => createFile(shell),
  });
  const status = mountShellStatus(shell);
  const rootTreeActions = mountRootTreeActions(shell);
  const cleanupTitlebar = mountTitlebar(collectTitlebarShell(root));
  const cleanupLayout = mountLayout(collectLayoutShell(root));
  const toastContainer = mountToastContainer(collectToastContainerShell(root));
  const confirmModal = mountConfirmModal(collectConfirmModalShell(root));
  const importMergeDialog = mountImportMergeDialog(collectImportMergeDialogShell(root));
  const moveDialog = mountMoveDialog(collectMoveDialogShell(root));
  const shortcutsDialog = mountKeyboardShortcutsDialog(
    collectKeyboardShortcutsDialogShell(root),
  );
  const searchBar = mountSearchBar(collectSearchBarShell(root));
  const bookmarkTree = mountBookmarkTree(collectBookmarkTreeShell(root));
  const detailPanel = mountDetailPanel(collectDetailPanelShell(root));
  const globalShortcuts = mountGlobalShortcuts({
    searchInput: shell.searchInput,
    focusSearch: () => searchBar.focus(),
    focusTree: () => bookmarkTree.focusTree(),
    openFile: () => openFile(shell),
    createFile: () => createFile(shell),
  });
  const lifecycle = mountAppLifecycle({
    featureCleanups: [
      { cleanup: cleanupTitlebar },
      { cleanup: cleanupLayout },
      toastContainer,
      confirmModal,
      importMergeDialog,
      moveDialog,
      shortcutsDialog,
      globalShortcuts,
      searchBar,
      bookmarkTree,
      detailPanel,
      rootTreeActions,
      status,
    ],
  });
  searchBar.focus();
  void bootstrapSession();
  void lifecycle;
  return shell;
}
