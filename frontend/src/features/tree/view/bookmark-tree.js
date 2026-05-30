// @ts-check

import { effect, list, mount, template } from "../../../shared/runtime/naf.js";
import { searchState } from "../../search/state/search-state.js";
import { treeState } from "../state/tree-state.js";
import { createBookmarkTreeDndController } from "../interactions/bookmark-tree-dnd.js";
import { createBookmarkTreeKeydownHandler } from "../interactions/bookmark-tree-keyboard.js";
import { mountBookmarkSearchResultRow } from "./bookmark-search-result-row.js";
import { mountBookmarkTreeRow } from "./bookmark-tree-row.js";

/**
 * @typedef {import("../../../types.js").BookmarkIndexEntry} BookmarkIndexEntry
 */

/** @type {string} */
const TREE_NODE_HTML = /*html*/ `
  <article class="tree-node">
    <div
      class="tree-row menu-item"
      role="treeitem"
      tabindex="-1"
      aria-selected="false"
    >
      <button
        class="tree-row__toggle btn btn-ghost btn-sm btn-square"
        type="button"
        aria-label="Toggle folder"
      ></button>
      <span
        class="tree-row__folder-icon"
        aria-hidden="true"
      ></span>
      <img class="tree-row__favicon" alt="" hidden />
      <span
        class="tree-row__bookmark-icon"
        aria-hidden="true"
      ></span>
      <span class="tree-row__label"></span>
      <span class="tree-row__count"></span>
    </div>
  </article>
`;

/** @type {string} */
const SEARCH_RESULT_HTML = /*html*/ `
  <article
    class="search-result menu-item"
    role="button"
    tabindex="0"
    aria-selected="false"
  >
    <span class="search-result__icon" aria-hidden="true"></span>
    <span class="search-result__label"></span>
    <span class="search-result__meta"></span>
  </article>
`;

/**
 * @typedef {object} BookmarkTreeShell
 * @property {HTMLElement} root
 * @property {HTMLElement} treeList
 * @property {HTMLElement} treePaneMeta
 */

/**
 * @param {ParentNode} root
 * @returns {BookmarkTreeShell}
 */
export function collectBookmarkTreeShell(root) {
  const treeList = root.querySelector("#tree-list");
  const treePaneMeta = root.querySelector("#tree-pane-meta");

  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected bookmark tree root element");
  }
  if (!(treeList instanceof HTMLElement)) {
    throw new Error("Expected #tree-list element");
  }
  if (!(treePaneMeta instanceof HTMLElement)) {
    throw new Error("Expected #tree-pane-meta element");
  }

  return {
    root,
    treeList,
    treePaneMeta,
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
    const renderEmptyTreeState = /** @type {TemplateTag} */ (
      template
    );
    const emptyState = renderEmptyTreeState`
      <div class="tree-empty-state">${message}</div>
    `;
    mount(emptyState, shell.treeList);
    stopList = () => {
      emptyState.unmount?.();
    };
  }

  /** @returns {void} */
  function renderMode() {
    stopList();
    shell.treeList.replaceChildren();

    if (searchState.selectors.isSearching()) {
      if (searchState.selectors.getResults().length === 0) {
        renderEmptyState("No results found");
        return;
      }

      stopList = list(
        shell.treeList,
        SEARCH_RESULT_HTML,
        () => searchState.selectors.getResults(),
        (item) => item.nodeId,
        (el, item) => {
          if (!(el instanceof HTMLElement)) {
            throw new Error("Expected search result element");
          }
          return mountBookmarkSearchResultRow(el, item);
        },
      );
      return;
    }

    if (treeState.selectors.getVisibleNodeEntries().length === 0) {
      renderEmptyState("No bookmarks or folders yet");
      return;
    }

    stopList = list(
      shell.treeList,
      TREE_NODE_HTML,
      () => treeState.selectors.getVisibleNodeEntries(),
      (item) => item.id,
        (el, item) => {
          if (!(el instanceof HTMLElement)) {
            throw new Error("Expected tree row element");
          }
          return mountBookmarkTreeRow(el, item, {
            onPointerDown: dnd.handleNodePointerDown,
            shouldIgnoreClick: dnd.shouldIgnoreClick,
          });
        },
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
