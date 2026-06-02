// @ts-check

import { requireElement } from "../shared/runtime/naf.js";

/**
 * @typedef {object} PageFrameShell
 * @property {HTMLElement} appToolbar
 * @property {HTMLElement} mainContent
 * @property {HTMLElement} treePane
 * @property {HTMLElement} detailPane
 * @property {HTMLButtonElement | HTMLElement} paneResizer
 */

/**
 * @param {PageFrameShell} shell
 * @returns {void}
 */
export function showLibraryFrame(shell) {
  shell.appToolbar.hidden = false;
  shell.treePane.hidden = false;
  shell.detailPane.hidden = false;
  shell.paneResizer.hidden = false;
  shell.mainContent.classList.remove("empty-library-page-shell");
}

/**
 * @param {PageFrameShell} shell
 * @returns {void}
 */
export function showEmptyLibraryFrame(shell) {
  shell.appToolbar.hidden = true;
  shell.treePane.hidden = true;
  shell.detailPane.hidden = true;
  shell.paneResizer.hidden = true;
  shell.mainContent.classList.add("empty-library-page-shell");
}

/**
 * Collect the dedicated page host anchor from the shell.
 *
 * @param {ParentNode} root
 * @returns {HTMLElement}
 */
export function collectPageHost(root) {
  return requireElement(root, "#page-host", "page-host");
}
