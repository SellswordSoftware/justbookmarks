// @ts-check

import { effect } from "../../shared/runtime/naf-html.js";
import { appState } from "../../shared/state/app-state.js";
import { treeState } from "../../features/tree/state/tree-state.js";
import {
  mountRootTreeActions,
  mountToolbarActions,
} from "../../components/toolbar/toolbar-actions.js";
import {
  collectBookmarkTreeShell,
  mountBookmarkTree,
} from "../../features/tree/view/bookmark-tree.js";
import {
  collectDetailPanelShell,
  mountDetailPanel,
} from "../../features/detail/view/detail-panel.js";
import { mountGlobalShortcuts } from "../../features/shortcuts/global-shortcuts.js";
import { collectSearchBarShell, mountSearchBar } from "../../features/search/view/search-bar.js";

/**
 * @typedef {object} LibraryPageShell
 * @property {HTMLElement} root
 * @property {HTMLElement} titlebarMeta
 * @property {HTMLInputElement} searchInput
 * @property {HTMLElement} treePaneActions
 * @property {HTMLElement} toolbarActions
 */

/**
 * @typedef {object} LibraryPageActions
 * @property {() => Promise<void>} openFile
 * @property {() => Promise<void>} createFile
 * @property {() => Promise<void>} importFile
 */

/**
 * @param {Array<{ cleanup: () => void }>} cleanups
 * @returns {{ cleanup: () => void }}
 */
function combineCleanups(cleanups) {
  return {
    cleanup() {
      for (const item of cleanups) {
        item.cleanup();
      }
    },
  };
}

/**
 * @param {LibraryPageShell} shell
 * @param {LibraryPageActions} actions
 * @returns {{ cleanup: () => void }}
 */
export function mountLibraryPage(shell, actions) {
  shell.searchInput.disabled = false;
  shell.searchInput.placeholder = "Search bookmarks...";

  const toolbarActions = mountToolbarActions(shell, actions);
  const rootTreeActions = mountRootTreeActions(shell);
  const searchBar = mountSearchBar(collectSearchBarShell(shell.root));
  const bookmarkTree = mountBookmarkTree(collectBookmarkTreeShell(shell.root));
  const detailPanel = mountDetailPanel(collectDetailPanelShell(shell.root));
  const globalShortcuts = mountGlobalShortcuts({
    searchInput: shell.searchInput,
    focusSearch: () => searchBar.focus(),
    focusTree: () => bookmarkTree.focusTree(),
    openFile: actions.openFile,
    createFile: actions.createFile,
  });

  const stopStatus = effect(() => {
    const filePath = appState.selectors.getCurrentFilePath();
    const treeError = treeState.selectors.getError();
    const loading = treeState.selectors.isLoading();

    shell.titlebarMeta.textContent = treeError
      ? treeError
      : filePath || (loading ? "Loading bookmark library..." : "Bookmark library");
  });

  searchBar.focus();

  return combineCleanups([
    globalShortcuts,
    searchBar,
    bookmarkTree,
    detailPanel,
    rootTreeActions,
    toolbarActions,
    {
      cleanup() {
        stopStatus();
      },
    },
  ]);
}
