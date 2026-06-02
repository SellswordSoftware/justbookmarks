// @ts-check

import {
  createEmptySelectionState,
  createSingleSelectionState,
  canJoinSelection as canJoinSelectionState,
  toggleSelected as toggleSelectedState,
  selectRange as selectRangeState,
  extendSelectionByOffset as extendSelectionByOffsetState,
  selectAllSiblings as selectAllSiblingsState,
  captureSelectionSnapshot as captureSelectionSnapshotState,
  restoreSelectionSnapshot as restoreSelectionSnapshotState,
} from "./selection.js";
import {
  getSiblingIds as getSiblingIdsFromTree,
} from "./structure.js";
import {
  tree,
  primarySelectedNodeId,
  selectedNodeIds,
  selectionAnchorNodeId,
  nodeIndex,
} from "./tree-state.js";

/** Selection actions and selectors. */

/**
 * @param {string} id
 * @returns {TreeNode | null}
 */
function getNode(id) {
  return nodeIndex().get(id) ?? null;
}

/**
 * @returns {{ selectedNodeIds: string[], primarySelectedNodeId: string, selectionAnchorNodeId: string }}
 */
function getSelectionState() {
  return {
    selectedNodeIds: selectedNodeIds(),
    primarySelectedNodeId: primarySelectedNodeId(),
    selectionAnchorNodeId: selectionAnchorNodeId(),
  };
}

/**
 * @param {{ selectedNodeIds: string[], primarySelectedNodeId: string, selectionAnchorNodeId: string }} nextState
 * @returns {void}
 */
function applySelectionState(nextState) {
  selectedNodeIds(nextState.selectedNodeIds);
  primarySelectedNodeId(nextState.primarySelectedNodeId);
  selectionAnchorNodeId(nextState.selectionAnchorNodeId);
}

// --- Selectors ---

/**
 * @param {string} id
 * @returns {boolean}
 */
function isSelected(id) {
  return nodeIndex().has(id) && selectedNodeIds().includes(id);
}

/** @returns {TreeNode | null} */
function getPrimarySelectedNode() {
  return primarySelectedNodeId() ? getNode(primarySelectedNodeId()) : null;
}

/** @returns {TreeNode[]} */
function getSelectedNodes() {
  return selectedNodeIds()
    .map((id) => getNode(id))
    .filter((node) => node !== null);
}

/**
 * @param {string} candidateId
 * @returns {boolean}
 */
function canJoinSelection(candidateId) {
  return canJoinSelectionState(tree(), getSelectionState(), candidateId);
}

/**
 * @param {string} id
 * @returns {string[]}
 */
function getSiblingIds(id) {
  return getSiblingIdsFromTree(tree(), id);
}

/** @returns {SelectionSnapshot} */
function captureSelectionSnapshot() {
  return captureSelectionSnapshotState(tree(), selectedNodeIds(), primarySelectedNodeId());
}

// --- Actions ---

/**
 * @param {string} id
 * @returns {void}
 */
function selectSingle(id) {
  if (!getNode(id)) {
    clearSelection();
    return;
  }
  applySelectionState(createSingleSelectionState(id));
}

/** @returns {void} */
function clearSelection() {
  applySelectionState(createEmptySelectionState());
}

/**
 * @param {string} id
 * @returns {void}
 */
function setPrimarySelected(id) {
  if (!id || !selectedNodeIds().includes(id)) {
    return;
  }
  primarySelectedNodeId(id);
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function toggleSelected(id) {
  const result = toggleSelectedState(tree(), getSelectionState(), id);
  if (!result.changed || !result.nextState) {
    return false;
  }
  applySelectionState(result.nextState);
  return true;
}

/**
 * @param {string} targetId
 * @param {string[]} visibleIds
 * @returns {boolean}
 */
function selectRange(targetId, visibleIds) {
  const result = selectRangeState(tree(), getSelectionState(), targetId, visibleIds);
  if (!result.changed || !result.nextState) {
    return false;
  }
  applySelectionState(result.nextState);
  return true;
}

/**
 * @param {string} targetId
 * @returns {boolean}
 */
function selectSiblingRange(targetId) {
  if (!targetId) {
    return false;
  }
  return selectRange(targetId, getSiblingIds(targetId));
}

/**
 * @param {number} offset
 * @returns {boolean}
 */
function extendSelectionByOffset(offset) {
  const result = extendSelectionByOffsetState(tree(), getSelectionState(), offset);
  if (!result.changed || !result.nextState) {
    return false;
  }
  applySelectionState(result.nextState);
  return true;
}

/** @returns {boolean} */
function selectAllSiblings() {
  const result = selectAllSiblingsState(tree(), getSelectionState());
  if (!result.changed || !result.nextState) {
    return false;
  }
  applySelectionState(result.nextState);
  return true;
}

/** @returns {void} */
function collapseSelectionToPrimary() {
  if (!primarySelectedNodeId()) {
    clearSelection();
    return;
  }
  selectedNodeIds([primarySelectedNodeId()]);
  selectionAnchorNodeId(primarySelectedNodeId());
}

/**
 * @param {SelectionSnapshot | null | undefined} snapshot
 * @returns {void}
 */
function restoreSelectionSnapshot(snapshot) {
  applySelectionState(restoreSelectionSnapshotState(tree(), snapshot));
}

// --- Exports ---

/** @type {Record<string, Function>} */
export const selectionActions = {
  selectSingle,
  clearSelection,
  setPrimarySelected,
  toggleSelected,
  selectRange,
  selectSiblingRange,
  extendSelectionByOffset,
  selectAllSiblings,
  collapseSelectionToPrimary,
  restoreSelectionSnapshot,
};

/** @type {Record<string, Function>} */
export const selectionSelectors = {
  isSelected,
  getSelectedNodes,
  getPrimarySelectedNode,
  canJoinSelection,
  getSiblingIds,
  captureSelectionSnapshot,
};
