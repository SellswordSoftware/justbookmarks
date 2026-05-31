// @ts-check

import { createBookmarkDetail } from "./bookmark-detail.js";
import { createBulkSelectionDetail } from "./bulk-selection-detail.js";
import { createFolderDetail } from "./folder-detail.js";
import { effect, mount, template } from "../../../shared/runtime/naf.js";
import { treeState } from "../../tree/state/tree-state.js";

/**
 * @param {TreeNode} node
 * @returns {node is FolderNode}
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
 * @param {TreeNode} node
 * @returns {Component<HTMLElement>}
 */
function renderSingleSelection(node) {
  if (isFolderNode(node)) {
    return createFolderDetail(node);
  }

  return createBookmarkDetail(node);
}

/**
 * @returns {Component<HTMLElement>}
 */
function createDetailEmptyState() {
  const renderEmptyState = /** @type {TemplateTag} */ (
    template
  );

  return renderEmptyState/*html*/`
    <div class="detail-empty-state">
      <p class="detail-empty-state__title">Select a bookmark or folder</p>
      <p class="detail-empty-state__subtitle">from the tree on the left</p>
    </div>
  `;
}

/**
 * @param {DetailPanelShell} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountDetailPanel(shell) {
  /** @type {Component<HTMLElement> | undefined} */
  let currentComponent;

  const stop = effect(() => {
    currentComponent?.unmount?.();
    currentComponent = undefined;
    shell.content.replaceChildren();

    const selectionCount = treeState.computed.selectionCount();
    const selectedNodeId = treeState.selectors.getSelectedNodeId();
    const selectedNode = selectedNodeId ? treeState.selectors.getNode(selectedNodeId) : null;

    if (selectionCount > 1) {
      shell.meta.textContent = `${selectionCount} items selected`;
      currentComponent = createBulkSelectionDetail();
      mount(currentComponent, shell.content);
      return;
    }

    if (!selectedNode) {
      shell.meta.textContent = "No selection yet";
      currentComponent = createDetailEmptyState();
      mount(currentComponent, shell.content);
      return;
    }

    shell.meta.textContent = isFolderNode(selectedNode) ? "Folder selected" : "Bookmark selected";
    currentComponent = renderSingleSelection(selectedNode);
    mount(currentComponent, shell.content);
  });

  return {
    cleanup() {
      currentComponent?.unmount?.();
      stop();
    },
  };
}
