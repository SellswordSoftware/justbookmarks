// @ts-check

import { cleanupCollector, effect, listener, requireElement } from "../shared/runtime/naf.js";
import { appState } from "../shared/state/app-state.js";

/**
 * @typedef {"n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw"} ResizeEdge
 */

/** @returns {boolean} */
function isLinuxWailsRuntime() {
  return appState.selectors.hasWailsRuntime() && window._wails?.environment?.OS === "linux";
}

/**
 * @param {ResizeEdge} edge
 * @returns {string}
 */
function toWailsBorder(edge) {
  return `${edge}-resize`;
}

/**
 * @param {HTMLElement} root
 * @returns {() => void}
 */
export function mountWindowResize(root) {
  const resizeRoot = /** @type {HTMLElement} */ (
    requireElement(root, "#window-resize-handles", "window-resize-handles")
  );
  const handles = Array.from(resizeRoot.querySelectorAll("[data-resize-edge]"));

  /** @returns {void} */
  function syncHandleVisibility() {
    const shouldEnable = isLinuxWailsRuntime() && !appState.selectors.isMaximised();
    resizeRoot.hidden = !shouldEnable;
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleMouseDown(event) {
    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    if (!isLinuxWailsRuntime() || appState.selectors.isMaximised()) {
      return;
    }

    const edge = /** @type {ResizeEdge | undefined} */ (event.currentTarget.dataset.resizeEdge);
    if (!edge) {
      return;
    }

    const border = toWailsBorder(edge);
    event.preventDefault();
    event.stopPropagation();
    requestAnimationFrame(() => {
      window._wails?.invoke?.(`wails:resize:${border}`);
    });
  }

  syncHandleVisibility();
  const stopVisibilityEffect = effect(() => {
    appState.selectors.isMaximised();
    syncHandleVisibility();
  });

  const cleanup = cleanupCollector(
    ...handles.map((handle) => listener(handle, "mousedown", handleMouseDown)),
    listener(window, "focus", syncHandleVisibility),
    listener(window, "resize", syncHandleVisibility),
    stopVisibilityEffect,
  );

  return () => {
    cleanup.run();
  };
}
