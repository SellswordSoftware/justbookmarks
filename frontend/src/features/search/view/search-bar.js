// @ts-check

import { cleanupCollector, effect, model } from "../../../shared/runtime/naf.js";
import { searchState } from "../state/search-state.js";

/**
 * @typedef {object} SearchBarShell
 * @property {HTMLInputElement} input
 */

/**
 * @param {ParentNode} root
 * @returns {SearchBarShell}
 */
export function collectSearchBarShell(root) {
  const input = root.querySelector("#search-input");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected #search-input element");
  }

  return {
    input,
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

  const stopEffect = effect(() => {
    if (!hasFocused) {
      shell.input.focus();
      hasFocused = true;
    }
  });

  const cleanup = cleanupCollector(
    queryBinding.cleanup,
    stopEffect,
  );

  return {
    focus,
    clear() {
      searchState.actions.clearQuery();
      shell.input.focus();
    },
    cleanup() {
      cleanup.run();
    },
  };
}
