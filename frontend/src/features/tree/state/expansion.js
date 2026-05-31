// @ts-check

import {
  getFolderNodeIds,
  getVisibleNodeEntries as getVisibleNodeEntriesFromTree,
  isFolderNode,
} from "./structure.js";

/**
 * @param {string[]} expandedNodeIds
 * @param {Iterable<string>} ancestorIds
 * @returns {string[]}
 */
export function expandAncestorIds(expandedNodeIds, ancestorIds) {
  const nextExpanded = [...expandedNodeIds];
  for (const ancestorId of ancestorIds) {
    if (!nextExpanded.includes(ancestorId)) {
      nextExpanded.push(ancestorId);
    }
  }
  return nextExpanded;
}

/**
 * @param {string[]} expandedNodeIds
 * @param {string} id
 * @returns {string[]}
 */
export function toggleExpandedId(expandedNodeIds, id) {
  if (expandedNodeIds.includes(id)) {
    return expandedNodeIds.filter((expandedId) => expandedId !== id);
  }
  return [...expandedNodeIds, id];
}

/**
 * @param {Iterable<string>} expandedNodeIds
 * @param {string} id
 * @returns {boolean}
 */
export function isExpandedId(expandedNodeIds, id) {
  return Array.from(expandedNodeIds).includes(id);
}

/**
 * @param {TreeNode[]} nodes
 * @param {Iterable<string>} expandedNodeIds
 * @returns {VisibleTreeNodeEntry[]}
 */
export function getVisibleNodeEntries(nodes, expandedNodeIds) {
  return getVisibleNodeEntriesFromTree(nodes, expandedNodeIds);
}

/**
 * @param {TreeNode[]} nodes
 * @param {Iterable<string>} expandedNodeIds
 * @returns {string[]}
 */
export function getVisibleNodeIds(nodes, expandedNodeIds) {
  return getVisibleNodeEntries(nodes, expandedNodeIds).map((entry) => entry.id);
}

/**
 * @param {TreeNode[]} nodes
 * @returns {string[]}
 */
export function getFolderNodeIdsFromState(nodes) {
  return getFolderNodeIds(nodes);
}

/**
 * @param {TreeNode[]} nodes
 * @returns {string[]}
 */
export function getDefaultExpandedFolderIds(nodes) {
  return nodes.filter((node) => isFolderNode(node)).map((node) => node.id);
}
