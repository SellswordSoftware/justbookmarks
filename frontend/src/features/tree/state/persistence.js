// @ts-check

import { createEmptySelectionState, createSingleSelectionState } from "./selection.js";
import { getNodeById } from "./structure.js";

/** @typedef {import("./selection.js").TreeSelectionState} TreeSelectionState */

/**
 * @param {TreeNode[]} nodes
 * @param {TreeSelectionState} selectionState
 * @returns {TreeSelectionState}
 */
export function pruneSelectionState(nodes, selectionState) {
  const validIds = selectionState.selectedNodeIds.filter((id) => Boolean(getNodeById(nodes, id)));
  if (validIds.length === 0) {
    return createEmptySelectionState();
  }

  const primarySelectedNodeId =
    selectionState.primarySelectedNodeId && validIds.includes(selectionState.primarySelectedNodeId)
      ? selectionState.primarySelectedNodeId
      : (validIds[0] ?? "");
  const selectionAnchorNodeId =
    selectionState.selectionAnchorNodeId && getNodeById(nodes, selectionState.selectionAnchorNodeId)
      ? selectionState.selectionAnchorNodeId
      : primarySelectedNodeId;

  return {
    selectedNodeIds: validIds,
    primarySelectedNodeId,
    selectionAnchorNodeId,
  };
}

/**
 * @param {TreeNode[]} nodes
 * @param {PerFileTreeState | null | undefined} state
 * @returns {{ expandedNodeIds: string[], selectionState: TreeSelectionState, scrollTop: number }}
 */
export function restorePersistentTreeState(nodes, state) {
  if (!state) {
    return {
      expandedNodeIds: [],
      selectionState: createEmptySelectionState(),
      scrollTop: 0,
    };
  }

  // With lazy-loading we often restore before deep folders/nodes are loaded,
  // so keep persisted IDs and let runtime hydration validate/fetch as needed.
  const expandedNodeIds = state.expandedNodeIds.filter((id) => typeof id === "string");
  const selectionState = state.selectedNodeId
    ? createSingleSelectionState(state.selectedNodeId)
    : createEmptySelectionState();

  return {
    expandedNodeIds,
    selectionState,
    scrollTop: typeof state.scrollTop === "number" && Number.isFinite(state.scrollTop)
      ? state.scrollTop
      : 0,
  };
}

/**
 * @param {string[]} expandedNodeIds
 * @param {string} primarySelectedNodeId
 * @param {number} scrollTop
 * @returns {PerFileTreeState}
 */
export function getPersistentTreeState(expandedNodeIds, primarySelectedNodeId, scrollTop) {
  return {
    expandedNodeIds: [...expandedNodeIds],
    selectedNodeId: primarySelectedNodeId,
    scrollTop,
  };
}
