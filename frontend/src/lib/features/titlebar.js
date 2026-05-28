// @ts-check

import { effect } from "../naf-html.js";
import { appState } from "../state/app-state.js";
import {
  Quit,
  WindowMinimise,
  WindowToggleMaximise,
} from "../../../wailsjs/runtime/runtime.js";

/**
 * @typedef {object} TitlebarShell
 * @property {HTMLElement} titlebar
 * @property {HTMLButtonElement} minimizeButton
 * @property {HTMLButtonElement} maximizeButton
 * @property {HTMLButtonElement} closeButton
 */

/**
 * @param {HTMLElement} titlebar
 * @returns {HTMLButtonElement}
 */
function requireButton(titlebar, selector) {
  const el = titlebar.querySelector(selector);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Expected button for selector: ${selector}`);
  }
  return el;
}

/** @returns {void} */
function minimiseWindow() {
  if (!appState.selectors.hasWailsRuntime()) {
    return;
  }
  WindowMinimise();
}

/** @returns {Promise<void>} */
async function toggleMaximiseWindow() {
  if (!appState.selectors.hasWailsRuntime()) {
    return;
  }
  WindowToggleMaximise();
  await appState.actions.syncWindowState();
}

/** @returns {void} */
function closeWindow() {
  if (!appState.selectors.hasWailsRuntime()) {
    return;
  }
  Quit();
}

/**
 * @param {TitlebarShell} shell
 * @returns {() => void}
 */
export function mountTitlebar(shell) {
  const handleMaximiseClick = () => {
    void toggleMaximiseWindow();
  };
  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  const handleDoubleClick = (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-wails-no-drag]")) {
      return;
    }
    void toggleMaximiseWindow();
  };
  const handleFocus = () => {
    void appState.actions.syncWindowState();
  };

  shell.minimizeButton.addEventListener("click", minimiseWindow);
  shell.maximizeButton.addEventListener("click", handleMaximiseClick);
  shell.closeButton.addEventListener("click", closeWindow);
  shell.titlebar.addEventListener("dblclick", handleDoubleClick);
  window.addEventListener("focus", handleFocus);

  const stopEffect = effect(() => {
    const hasRuntime = appState.selectors.hasWailsRuntime();
    const maximised = appState.selectors.isMaximised();

    shell.minimizeButton.disabled = !hasRuntime;
    shell.maximizeButton.disabled = !hasRuntime;
    shell.closeButton.disabled = !hasRuntime;

    shell.maximizeButton.textContent = maximised ? "❐" : "□";
    shell.maximizeButton.setAttribute(
      "aria-label",
      maximised ? "Restore window" : "Maximize window",
    );
    shell.maximizeButton.title = maximised ? "Restore" : "Maximize";
  });

  void appState.actions.syncWindowState();

  return () => {
    stopEffect();
    shell.minimizeButton.removeEventListener("click", minimiseWindow);
    shell.maximizeButton.removeEventListener("click", handleMaximiseClick);
    shell.closeButton.removeEventListener("click", closeWindow);
    shell.titlebar.removeEventListener("dblclick", handleDoubleClick);
    window.removeEventListener("focus", handleFocus);
  };
}

/**
 * @param {ParentNode} root
 * @returns {TitlebarShell}
 */
export function collectTitlebarShell(root) {
  const titlebar = root.querySelector("#titlebar");
  if (!(titlebar instanceof HTMLElement)) {
    throw new Error("Expected #titlebar element");
  }

  return {
    titlebar,
    minimizeButton: requireButton(titlebar, "#window-minimize"),
    maximizeButton: requireButton(titlebar, "#window-maximize"),
    closeButton: requireButton(titlebar, "#window-close"),
  };
}
