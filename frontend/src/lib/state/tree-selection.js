// @ts-check

import {
  getAncestorIds,
  getNodeById,
  getParentIdById,
  getSiblingIds,
} from "./tree-structure.js";

/** @typedef {import("../../types.js").TreeNode} TreeNode */

/**
 * @typedef {object} SelectionSnapshot
 * @property {string[]} selectedNodeIds
 * @property {string} primaryNodeId
 * @property {string[]} ancestorIds
 */

/**
 * @typedef {object} TreeSelectionState
 * @property {string[]} selectedNodeIds
 * @property {string} primarySelectedNodeId
 * @property {string} selectionAnchorNodeId
 */

/**
 * @typedef {object} SelectionChangeResult
 * @property {boolean} changed
 * @property {TreeSelectionState | null} nextState
 */

/**
 * @param {string} id
 * @returns {TreeSelectionState}
 */
export function createSingleSelectionState(id) {
  return {
    selectedNodeIds: [id],
    primarySelectedNodeId: id,
    selectionAnchorNodeId: id,
  };
}

/** @returns {TreeSelectionState} */
export function createEmptySelectionState() {
  return {
    selectedNodeIds: [],
    primarySelectedNodeId: "",
    selectionAnchorNodeId: "",
  };
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {TreeSelectionState} currentState
 * @param {string} candidateId
 * @returns {boolean}
 */
export function canJoinSelection(treeNodes, currentState, candidateId) {
  if (!candidateId) {
    return false;
  }

  const anchorId =
    currentState.selectionAnchorNodeId ||
    currentState.primarySelectedNodeId ||
    currentState.selectedNodeIds[0] ||
    "";
  if (!anchorId) {
    return Boolean(getNodeById(treeNodes, candidateId));
  }

  const anchorNode = getNodeById(treeNodes, anchorId);
  const candidateNode = getNodeById(treeNodes, candidateId);
  if (!anchorNode || !candidateNode) {
    return false;
  }

  return (
    anchorNode.type === candidateNode.type &&
    getParentIdById(treeNodes, anchorId) === getParentIdById(treeNodes, candidateId)
  );
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {TreeSelectionState} currentState
 * @param {string} targetId
 * @returns {SelectionChangeResult}
 */
export function toggleSelected(treeNodes, currentState, targetId) {
  if (!getNodeById(treeNodes, targetId)) {
    return { changed: false, nextState: null };
  }

  if (currentState.selectedNodeIds.length === 0) {
    return { changed: true, nextState: createSingleSelectionState(targetId) };
  }

  if (!canJoinSelection(treeNodes, currentState, targetId)) {
    return { changed: false, nextState: null };
  }

  if (currentState.selectedNodeIds.includes(targetId)) {
    const nextSelected = currentState.selectedNodeIds.filter((selectedId) => selectedId !== targetId);
    if (nextSelected.length === 0) {
      return { changed: true, nextState: createEmptySelectionState() };
    }

    return {
      changed: true,
      nextState: {
        selectedNodeIds: nextSelected,
        primarySelectedNodeId:
          currentState.primarySelectedNodeId === targetId
            ? (nextSelected[0] ?? "")
            : currentState.primarySelectedNodeId,
        selectionAnchorNodeId: currentState.selectionAnchorNodeId,
      },
    };
  }

  const nextSelected = [...currentState.selectedNodeIds, targetId];
  return {
    changed: true,
    nextState: {
      selectedNodeIds: nextSelected,
      primarySelectedNodeId: targetId,
      selectionAnchorNodeId: currentState.selectionAnchorNodeId || nextSelected[0] || "",
    },
  };
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {TreeSelectionState} currentState
 * @param {string} targetId
 * @param {string[]} visibleIds
 * @returns {SelectionChangeResult}
 */
export function selectRange(treeNodes, currentState, targetId, visibleIds) {
  if (!currentState.selectionAnchorNodeId) {
    if (!getNodeById(treeNodes, targetId)) {
      return { changed: false, nextState: null };
    }
    return { changed: true, nextState: createSingleSelectionState(targetId) };
  }

  if (!canJoinSelection(treeNodes, currentState, targetId)) {
    return { changed: false, nextState: null };
  }

  const anchorIndex = visibleIds.indexOf(currentState.selectionAnchorNodeId);
  const targetIndex = visibleIds.indexOf(targetId);
  if (anchorIndex < 0 || targetIndex < 0) {
    if (!getNodeById(treeNodes, targetId)) {
      return { changed: false, nextState: null };
    }
    return { changed: true, nextState: createSingleSelectionState(targetId) };
  }

  const [start, end] =
    anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  const rangeIds = visibleIds
    .slice(start, end + 1)
    .filter((id) => canJoinSelection(treeNodes, currentState, id));
  if (rangeIds.length === 0) {
    return { changed: false, nextState: null };
  }

  return {
    changed: true,
    nextState: {
      selectedNodeIds: rangeIds,
      primarySelectedNodeId: targetId,
      selectionAnchorNodeId: currentState.selectionAnchorNodeId,
    },
  };
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {TreeSelectionState} currentState
 * @param {number} offset
 * @returns {SelectionChangeResult}
 */
export function extendSelectionByOffset(treeNodes, currentState, offset) {
  if (offset === 0) {
    return { changed: false, nextState: null };
  }

  const anchorId =
    currentState.selectionAnchorNodeId ||
    currentState.primarySelectedNodeId ||
    currentState.selectedNodeIds[0] ||
    "";
  const pivotId =
    currentState.primarySelectedNodeId ||
    currentState.selectedNodeIds[currentState.selectedNodeIds.length - 1] ||
    anchorId;
  if (!anchorId || !pivotId) {
    return { changed: false, nextState: null };
  }

  const siblingIds = getSiblingIds(treeNodes, anchorId);
  const pivotIndex = siblingIds.indexOf(pivotId);
  if (pivotIndex < 0) {
    return { changed: false, nextState: null };
  }

  const nextIndex = Math.min(Math.max(pivotIndex + offset, 0), siblingIds.length - 1);
  if (nextIndex === pivotIndex) {
    return { changed: false, nextState: null };
  }

  return selectRange(treeNodes, currentState, siblingIds[nextIndex], siblingIds);
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {TreeSelectionState} currentState
 * @returns {SelectionChangeResult}
 */
export function selectAllSiblings(treeNodes, currentState) {
  const primaryId = currentState.primarySelectedNodeId || currentState.selectedNodeIds[0] || "";
  if (!primaryId) {
    return { changed: false, nextState: null };
  }

  const siblingIds = getSiblingIds(treeNodes, primaryId).filter((id) =>
    canJoinSelection(treeNodes, currentState, id),
  );
  if (siblingIds.length === 0) {
    return { changed: false, nextState: null };
  }

  return {
    changed: true,
    nextState: {
      selectedNodeIds: siblingIds,
      primarySelectedNodeId: siblingIds.includes(primaryId) ? primaryId : siblingIds[0] || "",
      selectionAnchorNodeId: siblingIds[0] || "",
    },
  };
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {string[]} selectedNodeIds
 * @param {string} primarySelectedNodeId
 * @returns {SelectionSnapshot}
 */
export function captureSelectionSnapshot(treeNodes, selectedNodeIds, primarySelectedNodeId) {
  const primaryNodeId = primarySelectedNodeId || selectedNodeIds[0] || "";
  return {
    selectedNodeIds: [...selectedNodeIds],
    primaryNodeId,
    ancestorIds: primaryNodeId ? getAncestorIds(treeNodes, primaryNodeId) : [],
  };
}

/**
 * @param {TreeNode[]} treeNodes
 * @param {SelectionSnapshot | null | undefined} snapshot
 * @returns {TreeSelectionState}
 */
export function restoreSelectionSnapshot(treeNodes, snapshot) {
  if (!snapshot) {
    return createEmptySelectionState();
  }

  const validSelected = snapshot.selectedNodeIds.filter((id) => Boolean(getNodeById(treeNodes, id)));
  if (validSelected.length > 1) {
    const firstNode = getNodeById(treeNodes, validSelected[0] ?? "");
    const sameTypeAndParent = firstNode
      ? validSelected.every((id) => {
          const candidate = getNodeById(treeNodes, id);
          if (!candidate) {
            return false;
          }
          return (
            candidate.type === firstNode.type &&
            getParentIdById(treeNodes, id) === getParentIdById(treeNodes, validSelected[0] ?? "")
          );
        })
      : false;

    if (sameTypeAndParent) {
      return {
        selectedNodeIds: validSelected,
        primarySelectedNodeId: validSelected.includes(snapshot.primaryNodeId)
          ? snapshot.primaryNodeId
          : (validSelected[0] ?? ""),
        selectionAnchorNodeId: validSelected[0] ?? "",
      };
    }
  }

  if (snapshot.primaryNodeId && getNodeById(treeNodes, snapshot.primaryNodeId)) {
    return createSingleSelectionState(snapshot.primaryNodeId);
  }

  for (const ancestorId of snapshot.ancestorIds) {
    if (getNodeById(treeNodes, ancestorId)) {
      return createSingleSelectionState(ancestorId);
    }
  }

  if (validSelected[0]) {
    return createSingleSelectionState(validSelected[0]);
  }

  return createEmptySelectionState();
}
