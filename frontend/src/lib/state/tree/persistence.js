// @ts-check

import { createEmptySelectionState, createSingleSelectionState } from "./selection.js";
import { getFolderNodeIds, getNodeById } from "./structure.js";

/** @typedef {import("../../types.js").TreeNode} TreeNode */
/** @typedef {import("../../types.js").PerFileTreeState} PerFileTreeState */
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
 * @returns {{ expandedNodeIds: string[], selectionState: TreeSelectionState }}
 */
export function restorePersistentTreeState(nodes, state) {
  if (!state) {
    return {
      expandedNodeIds: [],
      selectionState: createEmptySelectionState(),
    };
  }

  const validFolderIds = new Set(getFolderNodeIds(nodes));
  const expandedNodeIds = state.expandedNodeIds.filter((id) => validFolderIds.has(id));
  const selectionState =
    state.selectedNodeId && getNodeById(nodes, state.selectedNodeId)
      ? createSingleSelectionState(state.selectedNodeId)
      : createEmptySelectionState();

  return { expandedNodeIds, selectionState };
}

/**
 * @param {string[]} expandedNodeIds
 * @param {string} primarySelectedNodeId
 * @returns {PerFileTreeState}
 */
export function getPersistentTreeState(expandedNodeIds, primarySelectedNodeId) {
  return {
    expandedNodeIds: [...expandedNodeIds],
    selectedNodeId: primarySelectedNodeId,
  };
}
