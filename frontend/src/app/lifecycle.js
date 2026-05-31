// @ts-check

import { effect } from "../shared/runtime/naf.js";
import { setPerFileTreeState } from "../shared/infra/persistence.js";
import { appState } from "../shared/state/app-state.js";
import { searchState } from "../features/search/state/search-state.js";
import { treeState } from "../features/tree/state/tree-state.js";

/**
 * @param {{ cleanup: () => void }[]} cleanups
 * @returns {() => void}
 */
function combineCleanups(cleanups) {
  return () => {
    for (const item of cleanups) {
      item.cleanup();
    }
  };
}

/**
 * @param {object} options
 * @param {Array<{ cleanup: () => void }>} options.featureCleanups
 * @returns {{ cleanup: () => void }}
 */
export function mountAppLifecycle(options) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let saveWindowSizeTimer = null;

  function schedulePersistWindowSize() {
    if (saveWindowSizeTimer) {
      clearTimeout(saveWindowSizeTimer);
    }

    saveWindowSizeTimer = setTimeout(() => {
      void appState.window.persistCurrentSize();
    }, 150);
  }

  const handleWindowResize = () => {
    schedulePersistWindowSize();
  };
  const stopTreePersistence = effect(() => {
    const currentFilePath = appState.currentFilePath();
    if (!currentFilePath) {
      return;
    }

    const nextTreeState = treeState.selectors.getPersistentState();
    setPerFileTreeState(currentFilePath, nextTreeState);
  });
  const stopThemeSync = effect(() => {
    const appShell = document.querySelector(".app-shell");
    if (appShell) {
      appShell.setAttribute("data-theme", appState.window.theme());
    }
  });
  const cleanupFeatures = combineCleanups(options.featureCleanups);

  const handleBeforeUnload = () => {
    if (saveWindowSizeTimer) {
      clearTimeout(saveWindowSizeTimer);
    }
    window.removeEventListener("resize", handleWindowResize);
    cleanupFeatures();
    stopTreePersistence();
    stopThemeSync();
    searchState.dispose();
    void appState.window.persistCurrentSize();
  };

  window.addEventListener("resize", handleWindowResize);
  window.addEventListener("beforeunload", handleBeforeUnload);

  return {
    cleanup() {
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    },
  };
}
