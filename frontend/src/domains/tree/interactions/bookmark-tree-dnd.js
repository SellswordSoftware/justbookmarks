// @ts-check

import { MoveNode } from "../../../shared/api/api.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { searchState } from "../../../lib/state/search-state.js";
import { treeState } from "../state/tree-state.js";
import { uiState } from "../../../shared/state/ui-state.js";

/**
 * @typedef {"before" | "after" | "inside"} DropPosition
 */

/**
 * @typedef {object} DropTarget
 * @property {string} targetId
 * @property {DropPosition} position
 */

/**
 * @typedef {object} BookmarkTreeDndOptions
 * @property {HTMLElement} treeList
 */

/**
 * @param {BookmarkTreeDndOptions} options
 * @returns {{
 *   shouldIgnoreClick: () => boolean,
 *   syncDropTargetClasses: () => void,
 *   clearDragState: () => void,
 *   handleNodePointerDown: (entry: import("../../../types.js").VisibleTreeNodeEntry, event: MouseEvent) => void,
 *   handleDocumentMouseMove: (event: MouseEvent) => void,
 *   handleDocumentMouseUp: (event: MouseEvent) => void,
 *   handleDocumentMouseLeave: () => void
 * }}
 */
export function createBookmarkTreeDndController(options) {
  /** @type {string} */
  let draggedNodeId = "";
  /** @type {DropTarget | null} */
  let dropTarget = null;
  /** @type {{ entryId: string, startX: number, startY: number } | null} */
  let pendingPointerDrag = null;
  let suppressNextClick = false;

  /** @returns {void} */
  function syncDropTargetClasses() {
    const rows = options.treeList.querySelectorAll(".tree-row");
    for (const row of rows) {
      if (!(row instanceof HTMLElement)) {
        continue;
      }

      const rowNodeId = row.dataset.nodeId ?? "";
      const isActiveTarget = dropTarget?.targetId === rowNodeId;
      row.classList.toggle("is-drop-before", isActiveTarget && dropTarget?.position === "before");
      row.classList.toggle("is-drop-after", isActiveTarget && dropTarget?.position === "after");
      row.classList.toggle("is-drop-inside", isActiveTarget && dropTarget?.position === "inside");
      row.classList.toggle("is-drag-source", draggedNodeId === rowNodeId);
    }
  }

  /** @returns {void} */
  function clearDragState() {
    draggedNodeId = "";
    dropTarget = null;
    pendingPointerDrag = null;
    document.body.classList.remove("is-tree-dragging");
    syncDropTargetClasses();
  }

  /**
   * @returns {boolean}
   */
  function shouldIgnoreClick() {
    if (!suppressNextClick) {
      return false;
    }

    suppressNextClick = false;
    return true;
  }

  /**
   * @param {MouseEvent} event
   * @returns {DropTarget | null}
   */
  function getDropTargetFromPoint(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target instanceof HTMLElement ? target.closest(".tree-row") : null;
    if (!(row instanceof HTMLElement)) {
      return null;
    }

    const entryId = row.dataset.nodeId ?? "";
    if (!entryId || entryId === draggedNodeId) {
      return null;
    }

    const visibleEntry = treeState.selectors
      .getVisibleNodeEntries()
      .find((entry) => entry.id === entryId);
    if (!visibleEntry) {
      return null;
    }

    const rect = row.getBoundingClientRect();
    if (rect.height <= 0) {
      return null;
    }

    const offsetY = event.clientY - rect.top;
    const topThreshold = rect.height * 0.3;
    const bottomThreshold = rect.height * 0.7;
    const isFolder = visibleEntry.node.type === 0;

    if (isFolder && offsetY > topThreshold && offsetY < bottomThreshold) {
      return { targetId: visibleEntry.id, position: "inside" };
    }

    return {
      targetId: visibleEntry.id,
      position: offsetY <= topThreshold ? "before" : "after",
    };
  }

  /**
   * @param {string} entryId
   * @returns {void}
   */
  function beginPointerDrag(entryId) {
    treeState.actions.selectSingle(entryId);
    draggedNodeId = entryId;
    dropTarget = null;
    suppressNextClick = true;
    document.body.classList.add("is-tree-dragging");
    syncDropTargetClasses();
  }

  /**
   * @param {DropTarget} target
   * @returns {Promise<boolean>}
   */
  async function applyDropTarget(target) {
    if (!draggedNodeId || draggedNodeId === target.targetId) {
      return false;
    }

    if (target.position === "inside") {
      await MoveNode(draggedNodeId, target.targetId, -1);
      return true;
    }

    const targetNode = treeState.selectors.getNode(target.targetId);
    if (!targetNode) {
      return false;
    }

    const parentId = treeState.selectors.getParentId(target.targetId);
    const targetIndex = parentId
      ? treeState.selectors.getChildIndex(parentId, targetNode.id)
      : treeState.selectors.getTree().findIndex((node) => node.id === targetNode.id);
    if (targetIndex < 0) {
      return false;
    }

    const insertIndex = target.position === "before" ? targetIndex : targetIndex + 1;
    await MoveNode(draggedNodeId, parentId, insertIndex);
    return true;
  }

  /**
   * @param {import("../../types.js").VisibleTreeNodeEntry} entry
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleNodePointerDown(entry, event) {
    if (searchState.selectors.isSearching()) {
      return;
    }

    if (treeState.computed.selectionCount() > 1) {
      if (event.button === 0) {
        uiState.actions.showToast("Drag-and-drop is disabled during multi-select", "warning");
      }
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest("button")) {
      return;
    }

    pendingPointerDrag = {
      entryId: entry.id,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleDocumentMouseMove(event) {
    if (pendingPointerDrag && !draggedNodeId) {
      const deltaX = event.clientX - pendingPointerDrag.startX;
      const deltaY = event.clientY - pendingPointerDrag.startY;
      if (Math.hypot(deltaX, deltaY) >= 4) {
        beginPointerDrag(pendingPointerDrag.entryId);
      }
    }

    if (!draggedNodeId) {
      return;
    }

    dropTarget = getDropTargetFromPoint(event);
    syncDropTargetClasses();
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleDocumentMouseUp(event) {
    pendingPointerDrag = null;

    if (!draggedNodeId) {
      return;
    }

    dropTarget = getDropTargetFromPoint(event);
    syncDropTargetClasses();

    const draggedId = draggedNodeId;
    const finalDropTarget = dropTarget;
    clearDragState();

    void (async () => {
      if (!finalDropTarget) {
        return;
      }

      try {
        draggedNodeId = draggedId;
        const moved = await applyDropTarget(finalDropTarget);
        if (moved) {
          await treeState.actions.refresh();
        }
      } catch (caughtError) {
        uiState.actions.showToast(`Move failed: ${getErrorMessage(caughtError)}`, "error");
      } finally {
        draggedNodeId = "";
      }
    })();
  }

  /** @returns {void} */
  function handleDocumentMouseLeave() {
    if (!draggedNodeId) {
      return;
    }

    dropTarget = null;
    syncDropTargetClasses();
  }

  return {
    shouldIgnoreClick,
    syncDropTargetClasses,
    clearDragState,
    handleNodePointerDown,
    handleDocumentMouseMove,
    handleDocumentMouseUp,
    handleDocumentMouseLeave,
  };
}
