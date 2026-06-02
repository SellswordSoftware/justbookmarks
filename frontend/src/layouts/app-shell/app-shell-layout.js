// @ts-check

import { cleanupCollector, effect, listener, requireElement } from "../../shared/runtime/naf.js";
import { setLeftPaneWidth } from "../../shared/infra/persistence.js";
import { appState } from "../../shared/state/app-state.js";

const MIN_LEFT_PANE_WIDTH = 260;
const RIGHT_PANE_MIN_WIDTH = 320;

/**
 * @typedef {object} LayoutShell
 * @property {HTMLElement} root
 * @property {HTMLElement} mainContent
 * @property {HTMLButtonElement} paneResizer
 */

/**
 * @param {number} nextWidth
 * @param {number} containerWidth
 * @returns {number}
 */
export function clampLeftPaneWidth(nextWidth, containerWidth) {
  const maxWidth = Math.max(MIN_LEFT_PANE_WIDTH, containerWidth - RIGHT_PANE_MIN_WIDTH);
  return Math.min(Math.max(nextWidth, MIN_LEFT_PANE_WIDTH), maxWidth);
}

/**
 * @param {ParentNode} root
 * @returns {LayoutShell}
 */
export function collectLayoutShell(root) {
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected layout root element");
  }

  return {
    root,
    mainContent: requireElement(root, "#main-content", "main-content"),
    paneResizer: /** @type {HTMLButtonElement} */ (requireElement(root, "#pane-resizer", "pane-resizer")),
  };
}

/**
 * @param {LayoutShell} shell
 * @returns {() => void}
 */
export function mountLayout(shell) {
  let leftPaneWidth = appState.persistedState().leftPaneWidth;
  let isResizing = false;

  /**
   * @param {number} width
   * @param {boolean} [persist=false]
   * @returns {void}
   */
  function applyLeftPaneWidth(width, persist = false) {
    const containerWidth = shell.mainContent.clientWidth;
    leftPaneWidth = clampLeftPaneWidth(width, containerWidth);
    shell.root.style.setProperty("--left-pane-width", `${leftPaneWidth}px`);
    if (persist) {
      const nextState = setLeftPaneWidth(leftPaneWidth);
      appState.persistedState(nextState);
    }
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function startResize(event) {
    event.preventDefault();
    isResizing = true;
    shell.root.dataset.resizing = "true";
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleResize(event) {
    if (!isResizing) {
      return;
    }

    const bounds = shell.mainContent.getBoundingClientRect();
    applyLeftPaneWidth(event.clientX - bounds.left);
  }

  /** @returns {void} */
  function stopResize() {
    if (!isResizing) {
      return;
    }

    isResizing = false;
    delete shell.root.dataset.resizing;
    applyLeftPaneWidth(leftPaneWidth, true);
  }

  /** @returns {void} */
  function handleWindowResize() {
    applyLeftPaneWidth(leftPaneWidth);
  }

  const stopEffect = effect(() => {
    applyLeftPaneWidth(appState.persistedState().leftPaneWidth);
  });

  applyLeftPaneWidth(leftPaneWidth);

  const cleanup = cleanupCollector(
    listener(shell.paneResizer, "mousedown", startResize),
    listener(window, "mousemove", handleResize),
    listener(window, "mouseup", stopResize),
    listener(window, "resize", handleWindowResize),
    stopEffect,
  );

  return cleanup.run;
}
