// @ts-check

import { searchState } from "../../search/state/search-state.js";
import { treeState } from "../state/tree-state.js";

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

/**
 * @param {(nodeId: string) => void} activateSearchNode
 * @returns {(event: KeyboardEvent) => void}
 */
export function createBookmarkTreeKeydownHandler(activateSearchNode) {
  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  return function handleTreeKeydown(event) {
    if (isEditableTarget(event.target)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === " ") {
      return;
    }

    if (searchState.selectors.isSearching()) {
      const searchResults = searchState.selectors.getResults();
      if (searchResults.length === 0) {
        return;
      }

      const currentResultIndex = searchResults.findIndex(
        (entry) => entry.nodeId === treeState.selectors.getSelectedNodeId(),
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextResult =
          currentResultIndex >= 0 ? searchResults[currentResultIndex + 1] : searchResults[0];
        if (nextResult) {
          activateSearchNode(nextResult.nodeId);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const prevResult =
          currentResultIndex > 0 ? searchResults[currentResultIndex - 1] : searchResults[0];
        if (prevResult) {
          activateSearchNode(prevResult.nodeId);
        }
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        if (searchResults[0]) {
          activateSearchNode(searchResults[0].nodeId);
        }
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        const lastResult = searchResults[searchResults.length - 1];
        if (lastResult) {
          activateSearchNode(lastResult.nodeId);
        }
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const activeResult =
          currentResultIndex >= 0 ? searchResults[currentResultIndex] : searchResults[0];
        if (activeResult) {
          activateSearchNode(activeResult.nodeId);
        }
      }
      return;
    }

    /** @type {VisibleTreeNodeEntry[]} */
    const visibleNodes = /** @type {VisibleTreeNodeEntry[]} */ (treeState.selectors.getVisibleNodeEntries());
    if (visibleNodes.length === 0) {
      return;
    }

    const currentIndex = visibleNodes.findIndex(
      (entry) => entry.id === treeState.selectors.getSelectedNodeId(),
    );
    const selectedEntry = currentIndex >= 0 ? visibleNodes[currentIndex] : null;

    if (event.key === "ArrowDown") {
      if (event.shiftKey) {
        event.preventDefault();
        treeState.actions.extendSelectionByOffset(1);
        return;
      }
      event.preventDefault();
      const nextEntry = currentIndex >= 0 ? visibleNodes[currentIndex + 1] : visibleNodes[0];
      if (nextEntry) {
        treeState.actions.selectSingle(nextEntry.id);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      if (event.shiftKey) {
        event.preventDefault();
        treeState.actions.extendSelectionByOffset(-1);
        return;
      }
      event.preventDefault();
      const prevEntry = currentIndex > 0 ? visibleNodes[currentIndex - 1] : visibleNodes[0];
      if (prevEntry) {
        treeState.actions.selectSingle(prevEntry.id);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      if (event.shiftKey && treeState.selectors.getSelectedNodeId()) {
        const siblingIds = treeState.selectors.getSiblingIds(
          treeState.selectors.getSelectedNodeId(),
        );
        treeState.actions.selectSiblingRange(
          siblingIds[0] ?? treeState.selectors.getSelectedNodeId(),
        );
      } else if (visibleNodes[0]) {
        treeState.actions.selectSingle(visibleNodes[0].id);
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      if (event.shiftKey && treeState.selectors.getSelectedNodeId()) {
        const siblingIds = treeState.selectors.getSiblingIds(
          treeState.selectors.getSelectedNodeId(),
        );
        treeState.actions.selectSiblingRange(
          siblingIds[siblingIds.length - 1] ?? treeState.selectors.getSelectedNodeId(),
        );
      } else {
        const lastVisible = visibleNodes[visibleNodes.length - 1];
        if (lastVisible) {
          treeState.actions.selectSingle(lastVisible.id);
        }
      }
      return;
    }

    if (event.key === "PageDown") {
      event.preventDefault();
      const nextEntry =
        visibleNodes[Math.min(currentIndex >= 0 ? currentIndex + 10 : 10, visibleNodes.length - 1)];
      if (nextEntry) {
        treeState.actions.selectSingle(nextEntry.id);
      }
      return;
    }

    if (event.key === "PageUp") {
      event.preventDefault();
      const prevEntry = visibleNodes[Math.max((currentIndex >= 0 ? currentIndex : 0) - 10, 0)];
      if (prevEntry) {
        treeState.actions.selectSingle(prevEntry.id);
      }
      return;
    }

    if (!selectedEntry) {
      return;
    }

    if (event.key === "ArrowRight" && selectedEntry.node.type === 0) {
      event.preventDefault();
      if (!treeState.selectors.isExpanded(selectedEntry.id)) {
        treeState.actions.toggleExpand(selectedEntry.id);
      } else {
        const firstChild = selectedEntry.node.folder.children?.[0];
        if (firstChild) {
          treeState.actions.selectSingle(firstChild.id);
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (selectedEntry.node.type === 0 && treeState.selectors.isExpanded(selectedEntry.id)) {
        treeState.actions.toggleExpand(selectedEntry.id);
      } else if (selectedEntry.parentId) {
        treeState.actions.selectSingle(selectedEntry.parentId);
      }
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (selectedEntry.node.type === 0 && event.key === " ") {
        treeState.actions.toggleExpand(selectedEntry.id);
      } else {
        treeState.actions.selectSingle(selectedEntry.id);
      }
    }
  };
}
