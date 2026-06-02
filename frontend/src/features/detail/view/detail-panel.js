// @ts-check

import { createBookmarkDetail } from "./bookmark-detail.js";
import { createBulkSelectionDetail } from "./bulk-selection-detail.js";
import { createFolderDetail } from "./folder-detail.js";
import { effect, requireElement, template } from "../../../shared/runtime/naf.js";
import { treeState } from "../../tree/state/tree-state.js";

/**
 * @param {TreeNode} node
 * @returns {node is FolderNode}
 */
function isFolderNode(node) {
  return node.type === 0;
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
 * @param {ParentNode} root
 * @returns {{ cleanup: () => void }}
 */
export function mountDetailPanel(root) {
  const content = requireElement(root, "#detail-pane-content", "detail-pane-content");
  const meta = requireElement(root, "#detail-pane-meta", "detail-pane-meta");
  /** @type {Component | undefined} */
  let currentComponent;

  const stop = effect(() => {
    const selectionCount = treeState.computed.selectionCount();
    const selectedNodeId = treeState.selectors.getSelectedNodeId();
    const selectedNode = selectedNodeId ? treeState.selectors.getNode(selectedNodeId) : null;

    currentComponent?.unmount?.();

    if (selectionCount > 1) {
      currentComponent = createBulkSelectionDetail();
    } else if (selectedNode) {
      currentComponent = isFolderNode(selectedNode)
        ? createFolderDetail(selectedNode)
        : createBookmarkDetail(selectedNode);
    } else {
      currentComponent = createDetailEmptyState();
    }

    content.replaceChildren();
    currentComponent.mount(content);

    // Update meta text inline -- avoids a second effect.
    if (selectionCount > 1) {
      meta.textContent = `${selectionCount} items selected`;
    } else if (!selectedNode) {
      meta.textContent = "No selection yet";
    } else {
      meta.textContent = isFolderNode(selectedNode) ? "Folder selected" : "Bookmark selected";
    }
  });

  return {
    cleanup() {
      stop();
      currentComponent?.unmount?.();
    },
  };
}
