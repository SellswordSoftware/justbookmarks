// @ts-check

import { GetFlatIndex, GetFlatTree, GetRootNodes, GetTreeStats } from "../../../shared/api/api.js";
import { searchState } from "../../search/state/search-state.js";
import { buildSearchIndexInWorker } from "../../search/workers/search-worker-client.js";
import { normalizeFlatInWorker } from "../workers/tree-worker-client.js";
import { pruneSelectionState } from "./persistence.js";
import {
  tree,
  treeStats,
  selectedNodeIds,
  primarySelectedNodeId,
  selectionAnchorNodeId,
} from "./tree-state.js";

/** Async loading workflows. */

/**
 * Get current selection state from signals.
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
 * Apply selection state to signals.
 * @param {{ selectedNodeIds: string[], primarySelectedNodeId: string, selectionAnchorNodeId: string }} nextState
 * @returns {void}
 */
function applySelectionState(nextState) {
  selectedNodeIds(nextState.selectedNodeIds);
  primarySelectedNodeId(nextState.primarySelectedNodeId);
  selectionAnchorNodeId(nextState.selectionAnchorNodeId);
}

/**
 * Prune selection to remove IDs that no longer exist in the tree.
 * @returns {void}
 */
function pruneSelection() {
  applySelectionState(pruneSelectionState(tree(), getSelectionState()));
}

/**
 * Sync the full tree state from Go. Used for initial load and after mutations.
 * @returns {Promise<void>}
 */
export async function syncTreeState() {
  const [flatData, stats] = await Promise.all([GetFlatTree(), GetTreeStats()]);
  const normalized = await normalizeFlatInWorker(flatData);
  tree(normalized);
  searchState.actions.setIndex(await buildSearchIndexInWorker(normalized));
  treeStats(stats);
  pruneSelection();
}

/**
 * Sync only the root nodes and search index. Used for initial load.
 * @returns {Promise<void>}
 */
export async function syncRootNodes() {
  const [rootNodes, flatIndex, stats] = await Promise.all([GetRootNodes(), GetFlatIndex(), GetTreeStats()]);
  tree(await normalizeFlatInWorker(rootNodes));
  searchState.actions.setIndex(flatIndex);
  treeStats(stats);
  pruneSelection();
}

/**
 * Refresh only the search index from Go without reloading the tree.
 * @returns {Promise<void>}
 */
export async function syncSearchIndex() {
  const flatIndex = await GetFlatIndex();
  searchState.actions.setIndex(flatIndex);
}
