// @ts-check

import {
  expandAncestorIds,
  getFolderNodeIdsFromState,
  getVisibleNodeEntries as getVisibleNodeEntriesFromState,
  getVisibleNodeIds as getVisibleNodeIdsFromState,
  isExpandedId,
} from "./expansion.js";
import {
  getAncestorIds as getAncestorIdsFromTree,
} from "./structure.js";
import {
  tree,
  expandedNodeIds,
} from "./tree-state.js";

/** Expansion actions and selectors. */

// --- Actions ---

/**
 * @param {string} id
 * @returns {void}
 */
function expandAncestors(id) {
  expandedNodeIds(expandAncestorIds(expandedNodeIds(), getAncestorIdsFromTree(tree(), id)));
}

// --- Selectors ---

/**
 * @param {string} id
 * @returns {boolean}
 */
function isExpanded(id) {
  return isExpandedId(expandedNodeIds(), id);
}

/**
 * @param {TreeNode[]=} nodes
 * @returns {VisibleTreeNodeEntry[]}
 */
function getVisibleNodeEntries(nodes = tree()) {
  return getVisibleNodeEntriesFromState(nodes, expandedNodeIds());
}

/** @returns {string[]} */
function getVisibleNodeIds() {
  return getVisibleNodeIdsFromState(tree(), expandedNodeIds());
}

/**
 * @param {TreeNode[]=} nodes
 * @returns {string[]}
 */
function getFolderNodeIds(nodes = tree()) {
  return getFolderNodeIdsFromState(nodes);
}

// --- Exports ---

/** @type {Record<string, Function>} */
export const expansionActions = {
  expandAncestors,
};

/** @type {Record<string, Function>} */
export const expansionSelectors = {
  isExpanded,
  getVisibleNodeEntries,
  getVisibleNodeIds,
  getFolderNodeIds,
};
