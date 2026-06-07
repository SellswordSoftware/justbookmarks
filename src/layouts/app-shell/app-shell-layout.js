// @ts-check

import { cleanupCollector, effect, listener, requireElement } from "../../shared/runtime/naf.js";
import { setLeftPaneWidth } from "../../shared/infra/persistence.js";
import { appState } from "../../shared/state/app-state.js";

const MIN_LEFT_PANE_WIDTH = 260;
const RIGHT_PANE_MIN_WIDTH = 320;

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
 * @returns {() => void}
 */
export function mountLayout(root) {
  const layoutRoot = /** @type {HTMLElement} */ (root);
  const mainContent = requireElement(layoutRoot, "#main-content", "main-content");
  const paneResizer = /** @type {HTMLButtonElement} */ (requireElement(layoutRoot, "#pane-resizer", "pane-resizer"));
  let leftPaneWidth = appState.selectors.getPersistedState().leftPaneWidth;
  let isResizing = false;

  /**
   * @param {number} width
   * @param {boolean} [persist=false]
   * @returns {void}
   */
  function applyLeftPaneWidth(width, persist = false) {
    const containerWidth = mainContent.clientWidth;
    leftPaneWidth = clampLeftPaneWidth(width, containerWidth);
    layoutRoot.style.setProperty("--left-pane-width", `${leftPaneWidth}px`);
    if (persist) {
      const nextState = setLeftPaneWidth(leftPaneWidth);
      appState.signals.persistedState(nextState);
    }
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function startResize(event) {
    event.preventDefault();
    isResizing = true;
    layoutRoot.dataset.resizing = "true";
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleResize(event) {
    if (!isResizing) {
      return;
    }

    const bounds = mainContent.getBoundingClientRect();
    applyLeftPaneWidth(event.clientX - bounds.left);
  }

  /** @returns {void} */
  function stopResize() {
    if (!isResizing) {
      return;
    }

    isResizing = false;
    delete layoutRoot.dataset.resizing;
    applyLeftPaneWidth(leftPaneWidth, true);
  }

  /** @returns {void} */
  function handleWindowResize() {
    applyLeftPaneWidth(leftPaneWidth);
  }

  const stopEffect = effect(() => {
    applyLeftPaneWidth(appState.selectors.getPersistedState().leftPaneWidth);
  });

  applyLeftPaneWidth(leftPaneWidth);

  const cleanup = cleanupCollector(
    listener(paneResizer, "mousedown", startResize),
    listener(window, "mousemove", handleResize),
    listener(window, "mouseup", stopResize),
    listener(window, "resize", handleWindowResize),
    stopEffect,
  );

  return cleanup.run;
}
