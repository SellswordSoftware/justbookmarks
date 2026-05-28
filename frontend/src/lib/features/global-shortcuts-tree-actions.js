// @ts-check

import {
  DeleteNode,
  DeleteNodes,
  FetchFaviconsForNodes,
  RefreshTitlesForNodes,
} from "../../shared/api/api.js";
import { getErrorMessage } from "../../shared/infra/errors.js";
import { moveDialogState } from "../../domains/dialogs/move/move-dialog-state.js";
import { treeState } from "../../domains/tree/state/tree-state.js";
import { uiState } from "../../shared/state/ui-state.js";
import {
  clickKeyboardAction,
  focusDetailForSelection,
} from "./global-shortcuts-focus.js";

/**
 * @typedef {object} GlobalShortcutsTreeOptions
 * @property {() => void} focusSearch
 * @property {() => void} focusTree
 */

/**
 * @param {import("../../types.js").TreeNode} node
 * @returns {boolean}
 */
function isFolderNode(node) {
  return node.type === 0;
}

/** @returns {string} */
function getPrimarySelectionParentFolderId() {
  const primaryId = treeState.selectors.getSelectedNodeId();
  if (!primaryId) {
    return "";
  }
  return treeState.selectors.getParentId(primaryId);
}

/**
 * @returns {void}
 */
export function triggerOpenShortcut() {
  clickKeyboardAction("bookmark-open");
}

/**
 * @returns {void}
 */
export function triggerMoveShortcut() {
  if (treeState.computed.selectionCount() > 1) {
    const selectedNodes = treeState.selectors.getSelectedNodes();
    if (selectedNodes.length === 0) {
      return;
    }
    moveDialogState.actions.showBulkMoveDialog(
      treeState.selectors.getSelectedNodeIds(),
      isFolderNode(selectedNodes[0]) ? "folder" : "bookmark",
      treeState.selectors.getTree(),
    );
    return;
  }

  const selectedNode = treeState.selectors.getPrimarySelectedNode();
  if (!selectedNode) {
    return;
  }
  moveDialogState.actions.showMoveDialog(
    selectedNode.id,
    isFolderNode(selectedNode)
      ? selectedNode.folder.name
      : selectedNode.bookmark.title || selectedNode.bookmark.url,
    isFolderNode(selectedNode) ? "folder" : "bookmark",
    treeState.selectors.getTree(),
  );
}

/** @returns {void} */
export function triggerDeleteShortcut() {
  const selectedNodes = treeState.selectors.getSelectedNodes();
  if (selectedNodes.length === 0) {
    return;
  }

  if (selectedNodes.length > 1) {
    const label = isFolderNode(selectedNodes[0]) ? "Folders" : "Bookmarks";
    uiState.actions.showConfirm(
      `Delete ${label}`,
      `Delete ${selectedNodes.length} selected ${label.toLowerCase()}?`,
      "Delete",
      async () => {
        try {
          await DeleteNodes(treeState.selectors.getSelectedNodeIds());
          treeState.actions.clearSelection();
          await treeState.actions.refresh();
          uiState.actions.showToast(`${selectedNodes.length} ${label.toLowerCase()} deleted`, "success");
        } catch (caughtError) {
          uiState.actions.showToast(getErrorMessage(caughtError, "Bulk delete failed"), "error");
        }
      },
    );
    return;
  }

  const selectedNode = selectedNodes[0];
  const title = isFolderNode(selectedNode)
    ? selectedNode.folder.name
    : selectedNode.bookmark.title || selectedNode.bookmark.url;
  const noun = isFolderNode(selectedNode) ? "Folder" : "Bookmark";
  const message = isFolderNode(selectedNode)
    ? `Delete "${title}" and all of its contents?`
    : `Delete "${title}"?`;
  uiState.actions.showConfirm(
    `Delete ${noun}`,
    message,
    "Delete",
    async () => {
      try {
        await DeleteNode(selectedNode.id);
        treeState.actions.clearSelection();
        await treeState.actions.refresh();
        uiState.actions.showToast(`${noun} deleted`, "success");
      } catch (caughtError) {
        uiState.actions.showToast(
          getErrorMessage(caughtError, `Failed to delete ${noun.toLowerCase()}`),
          "error",
        );
      }
    },
  );
}

/**
 * @param {"favicons" | "titles"} kind
 * @returns {Promise<void>}
 */
export async function triggerBulkRefreshShortcut(kind) {
  const selectedNodes = treeState.selectors.getSelectedNodes();
  if (selectedNodes.length === 0 || isFolderNode(selectedNodes[0])) {
    return;
  }

  try {
    if (kind === "favicons") {
      await FetchFaviconsForNodes(treeState.selectors.getSelectedNodeIds());
      uiState.actions.showToast("Favicons refreshed", "success");
    } else {
      await RefreshTitlesForNodes(treeState.selectors.getSelectedNodeIds());
      uiState.actions.showToast("Titles refreshed", "success");
    }
    await treeState.actions.refresh();
  } catch (caughtError) {
    uiState.actions.showToast(
      getErrorMessage(
        caughtError,
        kind === "favicons" ? "Bulk favicon refresh failed" : "Bulk title refresh failed",
      ),
      "error",
    );
  }
}

/**
 * @returns {void}
 */
export function toggleMultiSelectOnPrimary() {
  const changed = treeState.actions.toggleSelected(treeState.selectors.getSelectedNodeId());
  if (!changed) {
    uiState.actions.showToast(
      "Multi-select only supports matching sibling bookmarks or folders",
      "warning",
    );
  }
}

/**
 * @param {GlobalShortcutsTreeOptions} _options
 * @returns {Promise<void>}
 */
export async function openAddBookmarkShortcut(_options) {
  const selectedNode = treeState.selectors.getPrimarySelectedNode();
  if (selectedNode && isFolderNode(selectedNode)) {
    if (!clickKeyboardAction("folder-add-bookmark")) {
      return;
    }
    await Promise.resolve();
    document.querySelector('[data-keyboard-action="add-bookmark-url"]')?.focus();
    return;
  }

  const parentId = getPrimarySelectionParentFolderId();
  if (parentId) {
    treeState.actions.selectSingle(parentId);
    await focusDetailForSelection();
    if (clickKeyboardAction("folder-add-bookmark")) {
      await Promise.resolve();
      document.querySelector('[data-keyboard-action="add-bookmark-url"]')?.focus();
    }
    return;
  }

  clickKeyboardAction("root-add-bookmark");
  await Promise.resolve();
  document.querySelector('[data-keyboard-action="add-bookmark-url"]')?.focus();
}

/**
 * @param {GlobalShortcutsTreeOptions} _options
 * @returns {Promise<void>}
 */
export async function openAddFolderShortcut(_options) {
  const selectedNode = treeState.selectors.getPrimarySelectedNode();
  if (selectedNode && isFolderNode(selectedNode)) {
    if (!clickKeyboardAction("folder-add-folder")) {
      return;
    }
    await Promise.resolve();
    document.querySelector('[data-keyboard-action="add-folder-name"]')?.focus();
    return;
  }

  const parentId = getPrimarySelectionParentFolderId();
  if (parentId) {
    treeState.actions.selectSingle(parentId);
    await focusDetailForSelection();
    if (clickKeyboardAction("folder-add-folder")) {
      await Promise.resolve();
      document.querySelector('[data-keyboard-action="add-folder-name"]')?.focus();
    }
    return;
  }

  clickKeyboardAction("root-add-folder");
  await Promise.resolve();
  document.querySelector('[data-keyboard-action="add-folder-name"]')?.focus();
}

/**
 * @param {boolean} renameOnly
 * @returns {Promise<void>}
 */
export async function triggerEditShortcut(renameOnly = false) {
  const selectedNode = treeState.selectors.getPrimarySelectedNode();
  if (!selectedNode) {
    return;
  }

  if (isFolderNode(selectedNode)) {
    if (clickKeyboardAction("folder-edit")) {
      await Promise.resolve();
      document.querySelector('[data-keyboard-action="folder-name"]')?.focus();
    }
    return;
  }

  if (renameOnly || clickKeyboardAction("bookmark-edit")) {
    await Promise.resolve();
    document.querySelector('[data-keyboard-action="bookmark-title"]')?.focus();
  }
}
