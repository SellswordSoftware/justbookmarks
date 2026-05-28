// @ts-check

import { searchState } from "../../domains/search/state/search-state.js";
import { treeState } from "../../domains/tree/state/tree-state.js";
import {
  focusDetailForSelection,
} from "./global-shortcuts-focus.js";
import { triggerOpenShortcut } from "./global-shortcuts-tree-actions.js";

/** @returns {string} */
function getSelectedSearchResultId() {
  if (!searchState.selectors.getQuery()) {
    return "";
  }

  const selectedId = treeState.selectors.getSelectedNodeId();
  if (
    selectedId &&
    searchState.selectors.getResults().some((result) => result.nodeId === selectedId)
  ) {
    return selectedId;
  }

  return searchState.selectors.getResults()[0]?.nodeId ?? "";
}

/**
 * @param {"detail" | "open"} mode
 * @returns {Promise<void>}
 */
export async function activateSearchResult(mode) {
  const nodeId = getSelectedSearchResultId();
  if (!nodeId) {
    return;
  }

  treeState.actions.expandAncestors(nodeId);
  treeState.actions.selectSingle(nodeId);

  if (mode === "open") {
    const node = treeState.selectors.getNode(nodeId);
    if (node && node.type !== 0) {
      await Promise.resolve();
      triggerOpenShortcut();
    }
    return;
  }

  await focusDetailForSelection();
}

/**
 * @param {HTMLInputElement} searchInput
 * @param {() => void} focusTree
 * @returns {(event: KeyboardEvent) => void}
 */
export function createSearchInputKeydownHandler(searchInput, focusTree) {
  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  return function handleSearchInputKeydown(event) {
    if (event.target !== searchInput) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (searchState.selectors.getQuery()) {
        searchState.actions.clearQuery();
      } else {
        focusTree();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (searchState.selectors.getQuery()) {
        const results = searchState.selectors.getResults();
        if (results[0]) {
          treeState.actions.expandAncestors(results[0].nodeId);
          treeState.actions.selectSingle(results[0].nodeId);
        }
      }
      focusTree();
      return;
    }

    if (event.key === "Enter" && searchState.selectors.getQuery()) {
      event.preventDefault();
      void activateSearchResult(event.ctrlKey || event.metaKey ? "open" : "detail");
    }
  };
}
