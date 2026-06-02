// @ts-check

import {
  CreateBookmarkFile,
  GetFilePath,
  OpenFilePicker,
} from "../../shared/api/api.js";
import {
  loadPersistedUIState,
  setLastOpenedFile,
  setTheme,
  setWindowState,
} from "../../shared/infra/persistence.js";
import { signal } from "../../shared/runtime/naf.js";
import { saving } from "./save-state.js";
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
 * Uses the canonical signals/actions/computed/selectors pattern.
 * See docs/frontend-architecture.md for the canonical shape.
 */

// -- Private signals --

const currentFilePath = signal("", { label: "app.currentFilePath" });
const hasTriedLoad = signal(false, { label: "app.hasTriedLoad" });
const persistenceReady = signal(false, { label: "app.persistenceReady" });
const isMaximised = signal(false, { label: "app.isMaximised" });
const keyboardShortcutsOpen = signal(false, { label: "app.keyboardShortcutsOpen" });
const theme = signal(loadPersistedUIState().theme ?? "light", { label: "app.theme" });
const persistedState = signal(loadPersistedUIState(), { label: "app.persistedState" });

// -- Private helpers --

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

// -- Public export --

export const appState = {
  signals: {
    currentFilePath,
    hasTriedLoad,
    persistenceReady,
    isMaximised,
    keyboardShortcutsOpen,
    saving,
    persistedState,
    theme,
  },
  computed: {},
  actions: {
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
    /**
     * @param {string} path
     * @returns {PersistedUIState}
     */
    rememberLoadedFile(path) {
      return rememberLoadedFile(path);
    },
    /** @returns {PersistedUIState} */
    reloadPersistedState() {
      return reloadPersistedState();
    },
    /**
     * @param {"light" | "dark"} value
     */
    setTheme(value) {
      theme(value);
      setTheme(value);
    },
    /** @returns {Promise<void>} */
    syncWindowState() {
      return syncWindowState();
    },
    /** @returns {Promise<WindowState | null>} */
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
    persistWindowState(windowState) {
      return persistWindowState(windowState);
    },
    /**
     * @param {boolean} value
     * @returns {boolean}
     */
    setKeyboardShortcutsOpen(value) {
      return keyboardShortcutsOpen(value);
    },
    /** @returns {boolean} */
    openKeyboardShortcuts() {
      return keyboardShortcutsOpen(true);
    },
    /** @returns {boolean} */
    closeKeyboardShortcuts() {
      return keyboardShortcutsOpen(false);
    },
  },
  selectors: {
    /** @returns {string} */
    getCurrentFilePath() {
      return currentFilePath();
    },
    /** @returns {boolean} */
    getHasTriedLoad() {
      return hasTriedLoad();
    },
    /** @returns {boolean} */
    getPersistenceReady() {
      return persistenceReady();
    },
    /** @returns {boolean} */
    isMaximised() {
      return isMaximised();
    },
    /** @returns {boolean} */
    isKeyboardShortcutsOpen() {
      return keyboardShortcutsOpen();
    },
    /** @returns {boolean} */
    isSaving() {
      return saving();
    },
    /** @returns {PersistedUIState} */
    getPersistedState() {
      return persistedState();
    },
    /** @returns {"light" | "dark"} */
    getTheme() {
      return theme();
    },
    /** @returns {boolean} */
    hasWailsRuntime() {
      return hasWailsRuntime();
    },
  },
};
