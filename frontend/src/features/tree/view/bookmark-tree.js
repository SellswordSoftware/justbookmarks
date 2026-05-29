// @ts-check

import { effect, list } from "../../../shared/runtime/naf-html.js";
import { searchState } from "../../search/state/search-state.js";
import { treeState } from "../state/tree-state.js";
import { createBookmarkTreeDndController } from "../interactions/bookmark-tree-dnd.js";
import { createBookmarkTreeKeydownHandler } from "../interactions/bookmark-tree-keyboard.js";
import { mountBookmarkSearchResultRow } from "./bookmark-search-result-row.js";
import { mountBookmarkTreeRow } from "./bookmark-tree-row.js";

/**
 * @typedef {import("../../../types.js").BookmarkIndexEntry} BookmarkIndexEntry
 */

/**
 * @typedef {object} BookmarkTreeShell
 * @property {HTMLElement} root
 * @property {HTMLElement} treeList
 * @property {HTMLElement} treePaneMeta
 * @property {HTMLTemplateElement} treeNodeTemplate
 * @property {HTMLTemplateElement} searchResultTemplate
 */

/**
 * @param {ParentNode} root
 * @returns {BookmarkTreeShell}
 */
export function collectBookmarkTreeShell(root) {
  const treeList = root.querySelector("#tree-list");
  const treePaneMeta = root.querySelector("#tree-pane-meta");
  const treeNodeTemplate = root.querySelector("#tree-node-template");
  const searchResultTemplate = root.querySelector("#search-result-template");

  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected bookmark tree root element");
  }
  if (!(treeList instanceof HTMLElement)) {
    throw new Error("Expected #tree-list element");
  }
  if (!(treePaneMeta instanceof HTMLElement)) {
    throw new Error("Expected #tree-pane-meta element");
  }
  if (!(treeNodeTemplate instanceof HTMLTemplateElement)) {
    throw new Error("Expected #tree-node-template template");
  }
  if (!(searchResultTemplate instanceof HTMLTemplateElement)) {
    throw new Error("Expected #search-result-template template");
  }

  return {
    root,
    treeList,
    treePaneMeta,
    treeNodeTemplate,
    searchResultTemplate,
  };
}

/**
 * @param {BookmarkTreeShell} shell
 * @returns {{ focusTree: () => void, cleanup: () => void }}
 */
export function mountBookmarkTree(shell) {
  let stopList = () => {};
  const dnd = createBookmarkTreeDndController({ treeList: shell.treeList });

  /**
   * @param {string} nodeId
   * @returns {void}
   */
  function activateSearchNode(nodeId) {
    treeState.actions.expandAncestors(nodeId);
    treeState.actions.selectSingle(nodeId);
  }
  const handleTreeKeydown = createBookmarkTreeKeydownHandler(activateSearchNode);

  /**
   * @param {string} message
   * @returns {void}
   */
  function renderEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "tree-empty-state";
    empty.textContent = message;
    shell.treeList.replaceChildren(empty);
  }

  /** @returns {void} */
  function renderMode() {
    stopList();
    shell.treeList.replaceChildren();

    if (searchState.selectors.isSearching()) {
      if (searchState.selectors.getResults().length === 0) {
        renderEmptyState("No results found");
        stopList = () => {};
        return;
      }

      stopList = list(
        shell.treeList,
        shell.searchResultTemplate,
        () => searchState.selectors.getResults(),
        (item) => item.nodeId,
        (el, item) => mountBookmarkSearchResultRow(el, item),
      );
      return;
    }

    if (treeState.selectors.getVisibleNodeEntries().length === 0) {
      renderEmptyState("No bookmarks or folders yet");
      stopList = () => {};
      return;
    }

    stopList = list(
      shell.treeList,
      shell.treeNodeTemplate,
      () => treeState.selectors.getVisibleNodeEntries(),
      (item) => item.id,
        (el, item) =>
          mountBookmarkTreeRow(el, item, {
            onPointerDown: dnd.handleNodePointerDown,
            shouldIgnoreClick: dnd.shouldIgnoreClick,
          }),
    );
  }

  const stopModeEffect = effect(() => {
    renderMode();
    dnd.syncDropTargetClasses();

    if (searchState.selectors.isSearching()) {
      const count = searchState.selectors.getResults().length;
      const query = searchState.selectors.getQuery();
      shell.treePaneMeta.textContent = `${count} result${count === 1 ? "" : "s"} for "${query}"`;
      return;
    }

    const items = treeState.selectors.getTree();
    const rootFolderCount = items.filter((item) => item.type === 0).length;
    shell.treePaneMeta.textContent =
      `${items.length} root item${items.length === 1 ? "" : "s"}, ` +
      `${rootFolderCount} folder${rootFolderCount === 1 ? "" : "s"}`;
  });

  shell.root.addEventListener("keydown", handleTreeKeydown);
  document.addEventListener("mousemove", dnd.handleDocumentMouseMove);
  document.addEventListener("mouseup", dnd.handleDocumentMouseUp);
  document.addEventListener("mouseleave", dnd.handleDocumentMouseLeave);

  return {
    focusTree() {
      shell.root.focus();
    },
    cleanup() {
      shell.root.removeEventListener("keydown", handleTreeKeydown);
      document.removeEventListener("mousemove", dnd.handleDocumentMouseMove);
      document.removeEventListener("mouseup", dnd.handleDocumentMouseUp);
      document.removeEventListener("mouseleave", dnd.handleDocumentMouseLeave);
      stopModeEffect();
      stopList();
      dnd.clearDragState();
    },
  };
}
