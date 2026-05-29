// @ts-check

import { effect } from "../shared/runtime/naf.js";
import { createFile, openFile } from "./session.js";
import { mountEmptyLibraryPage } from "../pages/empty-library/empty-library-page.js";
import { mountLibraryPage } from "../pages/library/library-page.js";
import { treeState } from "../features/tree/state/tree-state.js";
import { appState } from "../shared/state/app-state.js";

/** @typedef {"empty" | "library"} PageKind */
/** @typedef {{ cleanup: () => void }} PageMount */

/**
 * @typedef {object} PageShell
 * @property {HTMLElement} root
 * @property {HTMLInputElement} searchInput
 * @property {HTMLElement} titlebarMeta
 * @property {HTMLElement} appToolbar
 * @property {HTMLElement} mainContent
 * @property {HTMLElement} treePane
 * @property {HTMLElement} detailPane
 * @property {HTMLButtonElement} paneResizer
 * @property {HTMLElement} treePaneActions
 * @property {HTMLElement} toolbarActions
 */

/**
 * @param {PageKind} currentPageKind
 * @returns {PageKind}
 */
function resolvePageKind(currentPageKind) {
  const filePath = appState.currentFilePath();
  const loading = treeState.selectors.isLoading();
  const shouldKeepLibraryPage =
    currentPageKind === "library" &&
    !filePath &&
    !loading &&
    treeState.selectors.getTree().length > 0;

  return filePath || loading || shouldKeepLibraryPage ? "library" : "empty";
}

/**
 * @param {PageShell} shell
 * @param {{ openFile: () => Promise<void>, createFile: () => Promise<void>, importFile: () => Promise<void> }} pageActions
 * @param {PageKind} pageKind
 * @returns {PageMount}
 */
function mountPage(shell, pageActions, pageKind) {
  return pageKind === "library"
    ? mountLibraryPage(shell, pageActions)
    : mountEmptyLibraryPage(shell, pageActions);
}

/**
 * @param {PageShell} shell
 * @returns {PageMount}
 */
export function mountPageHost(shell) {
  let currentPage = /** @type {PageMount} */ ({
    cleanup() {},
  });
  /** @type {PageKind} */
  let currentPageKind = "empty";

  const pageActions = {
    openFile: () => openFile(shell),
    createFile: () => createFile(shell),
    importFile: () => appState.importMerge.openImportMerge(),
  };

  currentPage = mountPage(shell, pageActions, currentPageKind);

  const stop = effect(() => {
    const nextPageKind = resolvePageKind(currentPageKind);

    if (nextPageKind === currentPageKind) {
      return;
    }

    currentPage.cleanup();
    currentPageKind = nextPageKind;
    currentPage = mountPage(shell, pageActions, currentPageKind);
  });

  return {
    cleanup() {
      currentPage.cleanup();
      stop();
    },
  };
}
