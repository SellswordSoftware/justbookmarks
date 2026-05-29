// @ts-check

import {
  DeleteNodes,
  FetchFaviconsForNodes,
  RefreshTitlesForNodes,
} from "../../../shared/api/api.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { cleanupCollector, fx, signal } from "../../../shared/runtime/naf-html.js";
import { moveDialogState } from "../../move/move-dialog-state.js";
import { treeState } from "../../tree/state/tree-state.js";
import { uiState } from "../../../shared/state/ui-state.js";

/**
 * @typedef {"delete" | "move" | "favicons" | "titles" | ""} RunningAction
 */

/**
 * @param {import("../../../types.js").TreeNode} node
 * @returns {boolean}
 */
function isFolderNode(node) {
  return node.type === 0;
}

/**
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function createBulkSelectionDetail() {
  const wrapper = document.createElement("div");
  wrapper.className = "bulk-selection-detail";

  const header = document.createElement("div");
  header.className = "bulk-selection-detail__header";

  const summary = document.createElement("div");

  const eyebrow = document.createElement("p");
  eyebrow.className = "bulk-selection-detail__eyebrow";
  eyebrow.textContent = "Bulk Selection";

  const title = document.createElement("h3");
  title.className = "bulk-selection-detail__title";

  const subtitle = document.createElement("p");
  subtitle.className = "bulk-selection-detail__subtitle";

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "btn btn-ghost btn-sm";
  clearButton.textContent = "Clear";
  clearButton.setAttribute("data-keyboard-action", "bulk-clear");

  const actions = document.createElement("div");
  actions.className = "detail-inline-actions";

  const moveButton = document.createElement("button");
  moveButton.type = "button";
  moveButton.className = "btn btn-primary btn-sm";
  moveButton.textContent = "Move";
  moveButton.setAttribute("data-keyboard-action", "bulk-move");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-danger btn-sm btn-outline";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("data-keyboard-action", "bulk-delete");

  const faviconButton = document.createElement("button");
  faviconButton.type = "button";
  faviconButton.className = "btn btn-ghost btn-sm";
  faviconButton.textContent = "Fetch Favicons";
  faviconButton.setAttribute("data-keyboard-action", "bulk-fetch-favicons");

  const titleRefreshButton = document.createElement("button");
  titleRefreshButton.type = "button";
  titleRefreshButton.className = "btn btn-ghost btn-sm";
  titleRefreshButton.textContent = "Refresh Titles";
  titleRefreshButton.setAttribute("data-keyboard-action", "bulk-refresh-titles");

  const footer = document.createElement("div");
  footer.className = "bulk-selection-detail__footer";

  const footerText = document.createElement("p");
  footerText.className = "bulk-selection-detail__footer-text";
  footerText.textContent =
    "Bulk actions operate on the current sibling selection and save once when the command completes.";

  summary.append(eyebrow, title, subtitle);
  header.append(summary, clearButton);
  actions.append(moveButton, deleteButton, faviconButton, titleRefreshButton);
  footer.append(footerText);
  wrapper.append(header, actions, footer);

  const runningAction = signal(/** @type {RunningAction} */ (""));
  const cleanup = cleanupCollector();

  /**
   * @returns {import("../../types.js").TreeNode[]}
   */
  function getSelectedNodes() {
    return treeState.selectors.getSelectedNodes();
  }

  /**
   * @returns {import("../../types.js").TreeNode | null}
   */
  function getFirstNode() {
    return getSelectedNodes()[0] ?? null;
  }

  function isFolderSelection() {
    const firstNode = getFirstNode();
    return Boolean(firstNode && isFolderNode(firstNode));
  }

  function getSelectionLabel() {
    return isFolderSelection() ? "Folders" : "Bookmarks";
  }

  function getParentLabel() {
    const firstNode = getFirstNode();
    if (!firstNode) {
      return "Root";
    }
    const parentId = treeState.selectors.getParentId(firstNode.id);
    const parentNode = parentId ? treeState.selectors.getNode(parentId) : null;
    return parentNode && isFolderNode(parentNode) ? parentNode.folder.name : "Root";
  }

  async function refreshAfterAction(message) {
    await treeState.actions.refresh();
    uiState.actions.showToast(message, "success");
  }

  function openMoveDialog() {
    const selectedIds = treeState.selectors.getSelectedNodeIds();
    moveDialogState.actions.showBulkMoveDialog(
      selectedIds,
      isFolderSelection() ? "folder" : "bookmark",
      treeState.selectors.getTree(),
    );
  }

  function confirmDelete() {
    const selectionCount = treeState.computed.selectionCount();
    const selectionLabel = getSelectionLabel();

    uiState.actions.showConfirm(
      `Delete ${selectionLabel}`,
      `Delete ${selectionCount} selected ${selectionLabel.toLowerCase()}?`,
      "Delete",
      async () => {
        runningAction("delete");
        try {
          await DeleteNodes(treeState.selectors.getSelectedNodeIds());
          treeState.actions.clearSelection();
          await refreshAfterAction(`${selectionCount} ${selectionLabel.toLowerCase()} deleted`);
        } catch (caughtError) {
          uiState.actions.showToast(getErrorMessage(caughtError, "Bulk delete failed"), "error");
        } finally {
          runningAction("");
        }
      },
    );
  }

  async function fetchFavicons() {
    runningAction("favicons");
    try {
      await FetchFaviconsForNodes(treeState.selectors.getSelectedNodeIds());
      await refreshAfterAction("Favicons refreshed");
    } catch (caughtError) {
      uiState.actions.showToast(
        getErrorMessage(caughtError, "Bulk favicon refresh failed"),
        "error",
      );
    } finally {
      runningAction("");
    }
  }

  async function refreshTitles() {
    runningAction("titles");
    try {
      await RefreshTitlesForNodes(treeState.selectors.getSelectedNodeIds());
      await refreshAfterAction("Titles refreshed");
    } catch (caughtError) {
      uiState.actions.showToast(
        getErrorMessage(caughtError, "Bulk title refresh failed"),
        "error",
      );
    } finally {
      runningAction("");
    }
  }

  function clearSelection() {
    treeState.actions.clearSelection();
  }

  const handleMoveClick = () => {
    openMoveDialog();
  };
  const handleDeleteClick = () => {
    confirmDelete();
  };
  const handleFaviconClick = () => {
    void fetchFavicons();
  };
  const handleRefreshTitlesClick = () => {
    void refreshTitles();
  };

  moveButton.addEventListener("click", handleMoveClick);
  deleteButton.addEventListener("click", handleDeleteClick);
  faviconButton.addEventListener("click", handleFaviconClick);
  titleRefreshButton.addEventListener("click", handleRefreshTitlesClick);
  clearButton.addEventListener("click", clearSelection);
  cleanup.add(
    fx(title, (currentTitle) => {
      const selectionCount = treeState.computed.selectionCount();
      currentTitle.textContent = `${selectionCount} ${getSelectionLabel()}`;
    }),
    fx(subtitle, (currentSubtitle) => {
      currentSubtitle.textContent = `Sibling group: ${getParentLabel()}`;
    }),
    fx(clearButton, (currentClearButton) => {
      currentClearButton.disabled = runningAction() !== "";
    }),
    fx(moveButton, (currentMoveButton) => {
      currentMoveButton.disabled = runningAction() !== "";
    }),
    fx(deleteButton, (currentDeleteButton) => {
      const activeAction = runningAction();
      currentDeleteButton.disabled = activeAction !== "";
      currentDeleteButton.textContent = activeAction === "delete" ? "Deleting..." : "Delete";
    }),
    fx(faviconButton, (currentFaviconButton) => {
      const activeAction = runningAction();
      currentFaviconButton.hidden = isFolderSelection();
      currentFaviconButton.disabled = activeAction !== "";
      currentFaviconButton.textContent =
        activeAction === "favicons" ? "Fetching..." : "Fetch Favicons";
    }),
    fx(titleRefreshButton, (currentTitleRefreshButton) => {
      const activeAction = runningAction();
      currentTitleRefreshButton.hidden = isFolderSelection();
      currentTitleRefreshButton.disabled = activeAction !== "";
      currentTitleRefreshButton.textContent =
        activeAction === "titles" ? "Refreshing..." : "Refresh Titles";
    }),
  );

  return {
    element: wrapper,
    cleanup() {
      cleanup.run();
      moveButton.removeEventListener("click", handleMoveClick);
      deleteButton.removeEventListener("click", handleDeleteClick);
      faviconButton.removeEventListener("click", handleFaviconClick);
      titleRefreshButton.removeEventListener("click", handleRefreshTitlesClick);
      clearButton.removeEventListener("click", clearSelection);
    },
  };
}
