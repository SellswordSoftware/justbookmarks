// @ts-check

import { effect } from "../../shared/runtime/naf-html.js";
import { appState } from "../../shared/state/app-state.js";
import { searchState } from "../../features/search/state/search-state.js";
import { treeState } from "../../features/tree/state/tree-state.js";
import { mountGlobalShortcuts } from "../../features/shortcuts/global-shortcuts.js";
import { collectSearchBarShell, mountSearchBar } from "../../features/search/view/search-bar.js";
import { mountToolbarActions } from "../../components/toolbar/toolbar-actions.js";

/**
 * @typedef {object} EmptyLibraryPageShell
 * @property {HTMLElement} root
 * @property {HTMLElement} titlebarMeta
 * @property {HTMLInputElement} searchInput
 * @property {HTMLElement} treePaneMeta
 * @property {HTMLElement} treePaneActions
 * @property {HTMLElement} treePaneContent
 * @property {HTMLElement} detailPaneMeta
 * @property {HTMLElement} detailPaneContent
 * @property {HTMLElement} toolbarActions
 */

/**
 * @typedef {object} EmptyLibraryPageActions
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
 * @param {string} title
 * @param {string} body
 * @returns {HTMLElement}
 */
function createPlaceholderCard(title, body) {
  const card = document.createElement("div");
  card.className = "placeholder-card";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const text = document.createElement("span");
  text.textContent = body;

  card.append(heading, text);
  return card;
}

/**
 * @returns {HTMLElement}
 */
function createEmptyTreeContent() {
  const stack = document.createElement("div");
  stack.className = "placeholder-stack";
  stack.append(
    createPlaceholderCard("No library open", "Open an existing bookmark file or create a new one."),
    createPlaceholderCard("Import is available later", "Open a library first, then import or merge another file into it."),
  );
  return stack;
}

/**
 * @returns {HTMLElement}
 */
function createEmptyDetailContent() {
  const stack = document.createElement("div");
  stack.className = "placeholder-stack";
  stack.append(
    createPlaceholderCard("Nothing selected", "Selection details appear here after you open a library."),
  );
  return stack;
}

/**
 * @param {EmptyLibraryPageShell} shell
 * @param {EmptyLibraryPageActions} actions
 * @returns {{ cleanup: () => void }}
 */
export function mountEmptyLibraryPage(shell, actions) {
  searchState.actions.clearQuery();
  shell.treePaneActions.replaceChildren();
  shell.treePaneContent.replaceChildren(createEmptyTreeContent());
  shell.detailPaneContent.replaceChildren(createEmptyDetailContent());
  shell.searchInput.disabled = false;
  shell.searchInput.placeholder = "Search becomes available after opening a library";

  const toolbarActions = mountToolbarActions(shell, actions);
  const searchBar = mountSearchBar(collectSearchBarShell(shell.root));
  const globalShortcuts = mountGlobalShortcuts({
    searchInput: shell.searchInput,
    focusSearch: () => searchBar.focus(),
    focusTree: () => {},
    openFile: actions.openFile,
    createFile: actions.createFile,
  });

  const stopStatus = effect(() => {
    const treeError = treeState.selectors.getError();
    const loading = treeState.selectors.isLoading();
    const hasAttemptedLoad = appState.selectors.hasTriedLoad();

    shell.titlebarMeta.textContent = treeError
      ? treeError
      : loading
        ? "Loading bookmark library..."
        : hasAttemptedLoad
          ? "No bookmark file is open"
          : "Preparing bookmark library";
    shell.treePaneMeta.textContent = loading
      ? "Loading bookmark file..."
      : "Open or create a bookmark file to begin";
    shell.detailPaneMeta.textContent = "No library loaded";
  });

  searchBar.focus();

  return combineCleanups([
    globalShortcuts,
    searchBar,
    toolbarActions,
    {
      cleanup() {
        stopStatus();
      },
    },
  ]);
}
