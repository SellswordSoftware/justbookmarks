// @ts-check

import {
  CreateBookmarkFile,
  GetFilePath,
  OpenFilePicker,
} from "../../shared/api/api.js";
import {
  loadPersistedUIState,
  setLastOpenedFile,
  setWindowState,
} from "../../shared/infra/persistence.js";
import { signal } from "../../shared/runtime/naf.js";
import { importMergeState } from "../../features/import-merge/import-merge-state.js";
import {
  WindowGetSize,
  WindowIsMaximised,
  WindowIsNormal,
  WindowSetSize,
} from "../../../wailsjs/runtime/runtime.js";

/**
 * App/session state owner.
 *
 * Owns:
 * - current file path
 * - startup lifecycle
 * - window/runtime integration
 * - persisted shell settings coordination
 *
 * Public shape is intentionally small for now so later tasks can fill in
 * signals/actions without changing the import surface.
 */

/** @typedef {import("../../types.js").PersistedUIState} PersistedUIState */
/** @typedef {import("../../types.js").WindowState} WindowState */
const currentFilePath = signal("");
const hasTriedLoad = signal(false);
const persistenceReady = signal(false);
const isMaximised = signal(false);
const keyboardShortcutsOpen = signal(false);
const persistedState = signal(loadPersistedUIState());

/** @returns {boolean} */
function hasWailsRuntime() {
  return typeof window !== "undefined" && typeof window.runtime !== "undefined";
}

/** @returns {PersistedUIState} */
function reloadPersistedState() {
  const nextState = loadPersistedUIState();
  persistedState(nextState);
  return nextState;
}

/**
 * @param {string} path
 * @returns {PersistedUIState}
 */
function rememberLoadedFile(path) {
  const nextState = setLastOpenedFile(path);
  persistedState(nextState);
  currentFilePath(path);
  return nextState;
}

/** @returns {Promise<void>} */
async function syncWindowState() {
  if (!hasWailsRuntime()) {
    isMaximised(false);
    return;
  }

  try {
    isMaximised(await WindowIsMaximised());
  } catch {
    isMaximised(false);
  }
}

/**
 * @param {WindowState | null} windowState
 * @returns {PersistedUIState}
 */
function persistWindowState(windowState) {
  const nextState = setWindowState(windowState);
  persistedState(nextState);
  return nextState;
}

export const appState = {
  currentFilePath,
  hasTriedLoad,
  persistenceReady,
  isMaximised,
  keyboardShortcutsOpen,
  persistedState,
  hasWailsRuntime,
  session: {
    reloadPersistedState,
    /**
     * @param {string} path
     * @returns {PersistedUIState}
     */
    rememberLoadedFile(path) {
      return rememberLoadedFile(path);
    },
    /**
     * @param {string} path
     * @returns {string}
     */
    setCurrentFilePath(path) {
      return currentFilePath(path);
    },
    /**
     * @param {boolean} value
     * @returns {boolean}
     */
    setHasTriedLoad(value) {
      return hasTriedLoad(value);
    },
    /**
     * @param {boolean} value
     * @returns {boolean}
     */
    setPersistenceReady(value) {
      return persistenceReady(value);
    },
    /**
     * @returns {Promise<string>}
     */
    async getStartupFilePath() {
      return GetFilePath();
    },
    /**
     * @returns {Promise<string>}
     */
    async openFilePicker() {
      return OpenFilePicker();
    },
    /**
     * @returns {Promise<string>}
     */
    async createBookmarkFile() {
      return CreateBookmarkFile();
    },
    /**
     * @returns {Promise<void>}
     */
    async restoreWindowSize() {
      const state = persistedState();
      if (hasWailsRuntime() && state.window) {
        WindowSetSize(state.window.width, state.window.height);
      }
    },
  },
  window: {
    hasRuntime: hasWailsRuntime,
    sync: syncWindowState,
    /**
     * @returns {Promise<WindowState | null>}
     */
    async persistCurrentSize() {
      if (!persistenceReady() || !hasWailsRuntime()) {
        return null;
      }

      try {
        const normal = await WindowIsNormal();
        if (!normal) {
          return null;
        }

        const size = await WindowGetSize();
        const windowState = { width: size.w, height: size.h };
        persistWindowState(windowState);
        return windowState;
      } catch {
        return null;
      }
    },
    /**
     * @param {WindowState | null} windowState
     * @returns {PersistedUIState}
     */
    persistState(windowState) {
      return persistWindowState(windowState);
    },
  },
  keyboardShortcuts: {
    /**
     * @param {boolean} value
     * @returns {boolean}
     */
    set(value) {
      return keyboardShortcutsOpen(value);
    },
    /**
     * @returns {boolean}
     */
    open() {
      return keyboardShortcutsOpen(true);
    },
    /**
     * @returns {boolean}
     */
    close() {
      return keyboardShortcutsOpen(false);
    },
  },
  importMerge: {
    openImportMerge: importMergeState.actions.openImportMerge,
  },
};
