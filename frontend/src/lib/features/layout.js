// @ts-check

import { effect } from "../../shared/runtime/naf-html.js";
import { setLeftPaneWidth } from "../../shared/infra/persistence.js";
import { appState } from "../state/app-state.js";

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
 * @param {string} selector
 * @returns {HTMLElement}
 */
function requireElement(root, selector) {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Expected element for selector: ${selector}`);
  }
  return el;
}

/**
 * @param {ParentNode} root
 * @returns {LayoutShell}
 */
export function collectLayoutShell(root) {
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected layout root element");
  }

  const paneResizer = root.querySelector("#pane-resizer");
  if (!(paneResizer instanceof HTMLButtonElement)) {
    throw new Error("Expected #pane-resizer button");
  }

  return {
    root,
    mainContent: requireElement(root, "#main-content"),
    paneResizer,
  };
}

/**
 * @param {LayoutShell} shell
 * @returns {() => void}
 */
export function mountLayout(shell) {
  let leftPaneWidth = appState.selectors.getPersistedState().leftPaneWidth;
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

  shell.paneResizer.addEventListener("mousedown", startResize);
  window.addEventListener("mousemove", handleResize);
  window.addEventListener("mouseup", stopResize);
  window.addEventListener("resize", handleWindowResize);

  const stopEffect = effect(() => {
    applyLeftPaneWidth(appState.selectors.getPersistedState().leftPaneWidth);
  });

  applyLeftPaneWidth(leftPaneWidth);

  return () => {
    stopEffect();
    shell.paneResizer.removeEventListener("mousedown", startResize);
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", stopResize);
    window.removeEventListener("resize", handleWindowResize);
  };
}
