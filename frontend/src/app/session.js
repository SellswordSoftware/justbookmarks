// @ts-check

import { getErrorMessage } from "../shared/infra/errors.js";
import { clearLastOpenedFile } from "../shared/infra/persistence.js";
import { appState } from "../shared/state/app-state.js";
import { treeState } from "../features/tree/state/tree-state.js";
import { uiState } from "../shared/state/ui-state.js";

/**
 * @typedef {object} AppSessionShell
 * @property {HTMLInputElement} searchInput
 */

/**
 * @param {string} path
 * @param {boolean} [silentFailure=false]
 * @returns {Promise<boolean>}
 */
export async function loadFileIntoSession(path, silentFailure = false) {
  appState.session.setCurrentFilePath("");
  const loaded = await treeState.actions.loadFile(path);
  if (loaded) {
    const nextState = appState.session.reloadPersistedState();
    treeState.actions.restoreUIState(nextState.files[path]);
    appState.session.rememberLoadedFile(path);
    return true;
  }

  if (appState.session.reloadPersistedState().lastOpenedFile === path) {
    clearLastOpenedFile();
    appState.session.reloadPersistedState();
  }
  appState.session.setCurrentFilePath("");
  if (!silentFailure && treeState.selectors.getError()) {
    uiState.actions.showToast(treeState.selectors.getError(), "error");
  }
  return false;
}

/**
 * @param {AppSessionShell} shell
 * @returns {Promise<void>}
 */
export async function openFile(shell) {
  const path = await appState.session.openFilePicker();
  if (!path) {
    return;
  }

  const loaded = await loadFileIntoSession(path);
  appState.session.setHasTriedLoad(true);
  if (loaded) {
    shell.searchInput.focus();
  }
}

/**
 * @param {AppSessionShell} shell
 * @returns {Promise<void>}
 */
export async function createFile(shell) {
  try {
    const path = await appState.session.createBookmarkFile();
    if (!path) {
      return;
    }

    const loaded = await loadFileIntoSession(path);
    appState.session.setHasTriedLoad(true);
    if (!loaded) {
      return;
    }
    uiState.actions.showToast("Bookmark file created", "success");
    shell.searchInput.focus();
  } catch (caughtError) {
    uiState.actions.showToast(
      getErrorMessage(caughtError, "Failed to create bookmark file"),
      "error",
    );
  }
}

/** @returns {Promise<void>} */
export async function bootstrapSession() {
  const persistedState = appState.session.reloadPersistedState();
  await appState.session.restoreWindowSize();

  if (!window.go) {
    appState.session.setPersistenceReady(true);
    return;
  }

  const filePath = await appState.session.getStartupFilePath();
  if (typeof filePath === "string" && filePath.length > 0) {
    await loadFileIntoSession(filePath);
  } else if (persistedState.lastOpenedFile) {
    await loadFileIntoSession(persistedState.lastOpenedFile, true);
  }

  appState.session.setHasTriedLoad(true);
  await appState.window.sync();
  appState.session.setPersistenceReady(true);
}
