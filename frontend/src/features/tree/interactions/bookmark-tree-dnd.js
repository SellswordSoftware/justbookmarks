// @ts-check

import { MoveNode } from "../../../shared/api/api.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { searchState } from "../../search/state/search-state.js";
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
 *   handleNodePointerDown: (entry: VisibleTreeNodeEntry, event: MouseEvent) => void,
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
  /** @type {string | null} */
  let previousDropTargetId = null;
  /** @type {string | null} */
  let previousDragSourceId = null;

  /**
   * Clear drop-related CSS classes on a single row.
   * @param {HTMLElement} row
   * @returns {void}
   */
  function clearDropClasses(row) {
    row.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside", "is-drag-source");
  }

  /** @returns {void} */
  function clearAllDragClasses() {
    options.treeList
      .querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-inside, .is-drag-source")
      .forEach((row) => {
        if (row instanceof HTMLElement) {
          clearDropClasses(row);
        }
      });
  }

  /**
   * Set drop-related CSS classes on a single row.
   * @param {HTMLElement} row
   * @param {DropPosition} position
   * @returns {void}
   */
  function setDropClasses(row, position) {
    row.classList.add(`is-drop-${position}`);
  }

  /**
   * Look up a tree row element by its data-node-id attribute.
   * @param {string} nodeId
   * @returns {HTMLElement | null}
   */
  function findRow(nodeId) {
    return options.treeList.querySelector(`[data-node-id="${nodeId}"]`);
  }

  /** @returns {void} */
  function syncDropTargetClasses() {
    // Clear previous drop target
    if (previousDropTargetId !== null) {
      const prevRow = findRow(previousDropTargetId);
      if (prevRow instanceof HTMLElement) {
        clearDropClasses(prevRow);
      }
    }

    // Clear previous drag source
    if (previousDragSourceId !== null && previousDragSourceId !== draggedNodeId) {
      const prevSrc = findRow(previousDragSourceId);
      if (prevSrc instanceof HTMLElement) {
        prevSrc.classList.remove("is-drag-source");
      }
    }

    // Set new drop target
    if (dropTarget !== null) {
      const row = findRow(dropTarget.targetId);
      if (row instanceof HTMLElement) {
        setDropClasses(row, dropTarget.position);
      }
    }

    // Set new drag source
    if (draggedNodeId) {
      const src = findRow(draggedNodeId);
      if (src instanceof HTMLElement) {
        src.classList.add("is-drag-source");
      }
    }

    previousDropTargetId = dropTarget?.targetId ?? null;
    previousDragSourceId = draggedNodeId || null;
  }

  /** @returns {void} */
  function clearDragState() {
    draggedNodeId = "";
    dropTarget = null;
    pendingPointerDrag = null;
    document.body.classList.remove("is-tree-dragging");
    clearAllDragClasses();
    previousDropTargetId = null;
    previousDragSourceId = null;
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
   * @param {string} nodeId
   * @param {DropTarget} target
   * @returns {Promise<MoveResult | null>}
   */
  async function applyDropTarget(nodeId, target) {
    if (!nodeId || nodeId === target.targetId) {
      return null;
    }

    if (target.position === "inside") {
      return MoveNode(nodeId, target.targetId, -1);
    }

    const targetNode = treeState.selectors.getNode(target.targetId);
    if (!targetNode) {
      return null;
    }

    const parentId = treeState.selectors.getParentId(target.targetId);
    const targetIndex = parentId
      ? treeState.selectors.getChildIndex(parentId, targetNode.id)
      : treeState.selectors.getTree().findIndex((node) => node.id === targetNode.id);
    if (targetIndex < 0) {
      return null;
    }

    const insertIndex = target.position === "before" ? targetIndex : targetIndex + 1;
    return MoveNode(nodeId, parentId, insertIndex);
  }

  /**
   * @param {VisibleTreeNodeEntry} entry
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
        const result = await applyDropTarget(draggedId, finalDropTarget);
        if (result && !treeState.actions.applyMoveResult(result)) {
          await treeState.actions.refresh();
        }
      } catch (caughtError) {
        uiState.actions.showToast(`Move failed: ${getErrorMessage(caughtError)}`, "error");
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
