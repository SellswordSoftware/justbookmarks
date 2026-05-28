// @ts-check

import { effect } from "./naf-html.js";
import { setPerFileTreeState } from "./persistence.js";
import { appState } from "./state/app-state.js";
import { treeState } from "./state/tree/tree-state.js";

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
      void appState.actions.persistCurrentWindowSize();
    }, 150);
  }

  const handleWindowResize = () => {
    schedulePersistWindowSize();
  };
  const stopTreePersistence = effect(() => {
    const currentFilePath = appState.selectors.getCurrentFilePath();
    if (!currentFilePath) {
      return;
    }

    const nextTreeState = treeState.selectors.getPersistentState();
    setPerFileTreeState(currentFilePath, nextTreeState);
  });
  const cleanupFeatures = combineCleanups(options.featureCleanups);

  const handleBeforeUnload = () => {
    if (saveWindowSizeTimer) {
      clearTimeout(saveWindowSizeTimer);
    }
    window.removeEventListener("resize", handleWindowResize);
    cleanupFeatures();
    stopTreePersistence();
    void appState.actions.persistCurrentWindowSize();
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
