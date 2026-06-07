// @ts-check

import { cleanupCollector, effect, model, requireElement } from "../../../shared/runtime/naf.js";
import { searchState } from "../state/search-state.js";

/**
 * @param {ParentNode} root
 * @returns {{ focus: () => void, clear: () => void, cleanup: () => void }}
 */
export function mountSearchBar(root) {
  const input = /** @type {HTMLInputElement} */ (requireElement(root, "#search-input", "search-input"));
  let hasFocused = false;
  const queryBinding = model(input, searchState.signals.query, { reactive: true });

  /** @returns {void} */
  function focus() {
    input.focus();
    input.select();
  }

  const stopEffect = effect(() => {
    if (!hasFocused) {
      input.focus();
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
      input.focus();
    },
    cleanup() {
      cleanup.run();
    },
  };
}
