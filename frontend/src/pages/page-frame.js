// @ts-check

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
 * Create a dedicated host div appended to mainContent without destroying
 * existing shell children (tree-pane, detail-pane, pane-resizer).
 *
 * @param {HTMLElement} mainContent
 * @returns {HTMLDivElement}
 */
export function createPageHost(mainContent) {
  const host = document.createElement("div");
  mainContent.append(host);
  return host;
}
