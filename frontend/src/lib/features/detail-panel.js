// @ts-check

import { createBookmarkDetail } from "./bookmark-detail.js";
import { createBulkSelectionDetail } from "./bulk-selection-detail.js";
import { createFolderDetail } from "./folder-detail.js";
import { effect } from "../../shared/runtime/naf-html.js";
import { treeState } from "../state/tree/tree-state.js";

/**
 * @typedef {import("../../types.js").TreeNode} TreeNode
 */

/**
 * @param {TreeNode} node
 * @returns {boolean}
 */
function isFolderNode(node) {
  return node.type === 0;
}

/**
 * @typedef {object} DetailPanelShell
 * @property {HTMLElement} content
 * @property {HTMLElement} meta
 */

/**
 * @param {ParentNode} root
 * @returns {DetailPanelShell}
 */
export function collectDetailPanelShell(root) {
  const content = root.querySelector("#detail-pane-content");
  const meta = root.querySelector("#detail-pane-meta");

  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected #detail-pane-content element");
  }
  if (!(meta instanceof HTMLElement)) {
    throw new Error("Expected #detail-pane-meta element");
  }

  return {
    content,
    meta,
  };
}

/**
 * @param {string} title
 * @param {string} body
 * @returns {HTMLElement}
 */
function createPlaceholderCard(title, body) {
  const card = document.createElement("div");
  card.className = "placeholder-card";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const text = document.createElement("span");
  text.textContent = body;

  card.append(heading, text);
  return card;
}

/**
 * @param {TreeNode} node
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
function renderSingleSelection(node) {
  if (isFolderNode(node)) {
    return createFolderDetail(node);
  }

  return createBookmarkDetail(node);
}

/**
 * @param {DetailPanelShell} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountDetailPanel(shell) {
  let cleanupRendered = () => {};

  const stop = effect(() => {
    cleanupRendered();
    cleanupRendered = () => {};

    const selectionCount = treeState.computed.selectionCount();
    const selectedNodeId = treeState.selectors.getSelectedNodeId();
    const selectedNode = selectedNodeId ? treeState.selectors.getNode(selectedNodeId) : null;

    shell.content.replaceChildren();

    if (selectionCount > 1) {
      shell.meta.textContent = `${selectionCount} items selected`;
      const rendered = createBulkSelectionDetail();
      cleanupRendered = rendered.cleanup;
      shell.content.append(rendered.element);
      return;
    }

    if (!selectedNode) {
      shell.meta.textContent = "No selection yet";

      const empty = document.createElement("div");
      empty.className = "detail-empty-state";

      const title = document.createElement("p");
      title.className = "detail-empty-state__title";
      title.textContent = "Select a bookmark or folder";

      const subtitle = document.createElement("p");
      subtitle.className = "detail-empty-state__subtitle";
      subtitle.textContent = "from the tree on the left";

      empty.append(title, subtitle);
      shell.content.append(empty);
      return;
    }

    if (isFolderNode(selectedNode)) {
      shell.meta.textContent = "Folder selected";
    } else {
      shell.meta.textContent = "Bookmark selected";
    }
    const rendered = renderSingleSelection(selectedNode);
    cleanupRendered = rendered.cleanup;
    shell.content.append(rendered.element);
  });

  return {
    cleanup() {
      cleanupRendered();
      stop();
    },
  };
}
