// @ts-check

import { cleanupCollector, effect, model } from "../../../shared/runtime/naf.js";
import { searchState } from "../state/search-state.js";

/**
 * @typedef {object} SearchBarShell
 * @property {HTMLInputElement} input
 * @property {HTMLButtonElement} clearButton
 */

/**
 * @param {ParentNode} root
 * @returns {SearchBarShell}
 */
export function collectSearchBarShell(root) {
  const input = root.querySelector("#search-input");
  const clearButton = root.querySelector("#search-clear");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected #search-input element");
  }
  if (!(clearButton instanceof HTMLButtonElement)) {
    throw new Error("Expected #search-clear button");
  }

  return {
    input,
    clearButton,
  };
}

/**
 * @param {SearchBarShell} shell
 * @returns {{ focus: () => void, clear: () => void, cleanup: () => void }}
 */
export function mountSearchBar(shell) {
  let hasFocused = false;
  const queryBinding = model(shell.input, searchState.signals.query, { reactive: true });

  /** @returns {void} */
  function focus() {
    shell.input.focus();
    shell.input.select();
  }

  /** @returns {void} */
  function clear() {
    searchState.actions.clearQuery();
    shell.input.focus();
  }

  shell.clearButton.addEventListener("click", clear);

  const stopEffect = effect(() => {
    const query = searchState.selectors.getQuery();
    shell.clearButton.hidden = query.length === 0;

    if (!hasFocused) {
      shell.input.focus();
      hasFocused = true;
    }
  });

  const cleanup = cleanupCollector(
    queryBinding.cleanup,
    stopEffect,
    () => shell.clearButton.removeEventListener("click", clear),
  );

  return {
    focus,
    clear,
    cleanup() {
      cleanup.run();
    },
  };
}
