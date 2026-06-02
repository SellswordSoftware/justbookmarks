// @ts-check

import { GetFlatTree, LoadFile } from "../../../shared/api/api.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { computed, signal } from "../../../shared/runtime/naf.js";
import { toggleExpandedId } from "./expansion.js";
import {
  getPersistentTreeState,
  pruneSelectionState,
  restorePersistentTreeState,
} from "./persistence.js";
import {
  createEmptySelectionState,
  createSingleSelectionState,
} from "./selection.js";
import {
  getAncestorIds as getAncestorIdsFromTree,
  getChildIndexById,
  getNodeById,
  getNodeTypeById,
  getParentIdById,
  getParentNodeById,
} from "./structure.js";
import { selectionActions, selectionSelectors } from "./selection-state.js";
import { expansionActions, expansionSelectors } from "./expansion-state.js";
import { mutationActions } from "./tree-mutations.js";
import { syncTreeState, syncRootNodes } from "./load-workflow.js";

/** Tree state owner for normalized tree data, selection, expansion, and load/restore workflows. */

// === Signals ===

/** @type {TreeNode[]} */
const emptyTree = [];
/** @type {Signal<TreeNode[]>} */
export const tree = signal(emptyTree, { label: "tree.nodes" });
/** @type {Signal<string>} */
export const primarySelectedNodeId = signal("", { label: "tree.primarySelectedNodeId" });
/** @type {Signal<string[]>} */
export const selectedNodeIds = signal(/** @type {string[]} */ ([]), { label: "tree.selectedNodeIds" });
/** @type {Signal<string>} */
export const selectionAnchorNodeId = signal("", { label: "tree.selectionAnchorNodeId" });
/** @type {Signal<string[]>} */
export const expandedNodeIds = signal(/** @type {string[]} */ ([]), { label: "tree.expandedNodeIds" });
const treeScrollTop = signal(0, { label: "tree.scrollTop" });
/** Monotonically incremented whenever restoreUIState requests a scroll restore. */
const scrollRestoreVersion = signal(0, { label: "tree.scrollRestoreVersion" });
const loading = signal(false, { label: "tree.loading" });
const error = signal("", { label: "tree.error" });
/** @type {Signal<TreeStats>} */
export const treeStats = signal(/** @type {TreeStats} */ ({ folders: 0, bookmarks: 0 }), { label: "tree.stats" });

// === Computed ===

const selectionCount = computed(() => selectedNodeIds().length, { label: "tree.selectionCount" });
const hasMultiSelection = computed(() => selectedNodeIds().length > 1, { label: "tree.hasMultiSelection" });

/**
 * Flat Map index for O(1) node lookups.
 * Rebuilt whenever the tree signal changes.
 * @type {Computed<Map<string, TreeNode>>}
 */
export const nodeIndex = computed(() => {
  /** @type {Map<string, TreeNode>} */
  const map = new Map();
  /** @param {TreeNode[]} nodes */
  const index = (nodes) => {
    for (const node of nodes) {
      map.set(node.id, node);
      if (node.type === 0) {
        index(node.folder.children);
      }
    }
  };
  index(tree());
  return map;
}, { label: "tree.nodeIndex" });

// === Internal helpers ===

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

/** @returns {void} */
function pruneSelection() {
  applySelectionState(pruneSelectionState(tree(), getSelectionState()));
}

// === Orchestrator actions (span multiple concerns) ===

/**
 * Ensure a node is visible in the lazy tree (loading ancestor folders if needed),
 * then select it.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function revealAndSelectNode(id) {
  if (!id) {
    selectionActions.clearSelection();
    return false;
  }

  /** @type {string[]} */
  let selectedAncestors = [];
  try {
    selectedAncestors = getAncestorChainFromFlatTree(id, await GetFlatTree());
  } catch {
    selectedAncestors = [];
  }

  const expanded = new Set(expandedNodeIds());
  for (const ancestorId of selectedAncestors) {
    expanded.add(ancestorId);
  }
  expandedNodeIds([...expanded]);

  for (const folderId of selectedAncestors) {
    const folderNode = getNode(folderId);
    if (folderNode && folderNode.type === 0 && !folderNode.folder.childrenLoaded) {
      await mutationActions.loadFolderChildren(folderId);
    }
  }

  if (!getNode(id)) {
    selectionActions.clearSelection();
    return false;
  }
  selectionActions.selectSingle(id);
  return true;
}

/**
 * @param {string} id
 * @returns {void}
 */
function toggleExpand(id) {
  const node = getNode(id);
  if (!node || node.type !== 0) {
    return;
  }
  const currentlyExpanded = expansionSelectors.isExpanded(id);
  const childrenLoaded = node.folder.childrenLoaded;

  // Collapsed and not loaded: load children then expand
  if (!currentlyExpanded && !childrenLoaded) {
    mutationActions.loadFolderChildren(id).then(() => {
      expandedNodeIds(toggleExpandedId(expandedNodeIds(), id));
    });
    return;
  }

  // Expanded but not loaded (auto-expanded on initial load): load children, keep expanded
  if (currentlyExpanded && !childrenLoaded) {
    mutationActions.loadFolderChildren(id);
    return;
  }

  // Normal toggle (children are loaded)
  expandedNodeIds(toggleExpandedId(expandedNodeIds(), id));
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function loadFile(path) {
  loading(true);
  error("");
  // Clear the current tree immediately so loading UI doesn't overlap stale rows.
  tree(emptyTree);
  expandedNodeIds([]);
  treeScrollTop(0);
  scrollRestoreVersion(0);
  selectionActions.clearSelection();
  try {
    await LoadFile(path);
    await syncRootNodes();
    return true;
  } catch (caughtError) {
    error(getErrorMessage(caughtError, "Failed to load bookmark file"));
    return false;
  } finally {
    loading(false);
  }
}

/**
 * @param {PerFileTreeState | null | undefined} state
 * @returns {Promise<void>}
 */
async function restoreUIState(state) {
  const nextState = restorePersistentTreeState(tree(), state);
  const selectedId = nextState.selectionState.primarySelectedNodeId;
  /** @type {string[]} */
  let selectedAncestors = [];

  if (selectedId) {
    try {
      selectedAncestors = getAncestorChainFromFlatTree(selectedId, await GetFlatTree());
    } catch {
      selectedAncestors = [];
    }
  }

  const expanded = new Set(nextState.expandedNodeIds);
  for (const ancestorId of selectedAncestors) {
    expanded.add(ancestorId);
  }
  expandedNodeIds([...expanded]);
  applySelectionState(nextState.selectionState);

  for (const folderId of expanded) {
    const folderNode = getNode(folderId);
    if (folderNode && folderNode.type === 0 && !folderNode.folder.childrenLoaded) {
      await mutationActions.loadFolderChildren(folderId);
    }
  }

  // Set scroll position AFTER async loading completes so the visible node
  // count is final. Increment the restore version to signal the view layer
  // to apply the saved scroll position.
  treeScrollTop(nextState.scrollTop);
  scrollRestoreVersion(scrollRestoreVersion() + 1);

  if (selectedId && getNode(selectedId)) {
    selectionActions.selectSingle(selectedId);
  } else if (selectedId) {
    selectionActions.clearSelection();
  }
}

/** @returns {Promise<void>} */
async function refresh() {
  await syncTreeState();
}

// === Simple selectors ===

/**
 * @param {string} id
 * @returns {0 | 1 | null}
 */
function getNodeType(id) {
  return getNodeTypeById(tree(), id);
}

/**
 * @param {string} id
 * @returns {FolderNode | null}
 */
function getParentNode(id) {
  return getParentNodeById(tree(), id);
}

/**
 * @param {string} id
 * @returns {string}
 */
function getParentId(id) {
  return getParentIdById(tree(), id);
}

/**
 * @param {string} parentId
 * @param {string} childId
 * @returns {number}
 */
function getChildIndex(parentId, childId) {
  return getChildIndexById(tree(), parentId, childId);
}

/**
 * @param {string} id
 * @returns {string[]}
 */
function getAncestorIds(id) {
  return getAncestorIdsFromTree(tree(), id);
}

/** @returns {PerFileTreeState} */
function getPersistentState() {
  return getPersistentTreeState(expandedNodeIds(), primarySelectedNodeId(), treeScrollTop());
}

// === Export ===

export const treeState = {
  signals: {
    tree,
    primarySelectedNodeId,
    selectedNodeIds,
    selectionAnchorNodeId,
    expandedNodeIds,
    treeScrollTop,
    scrollRestoreVersion,
    loading,
    error,
  },
  computed: {
    selectionCount,
    hasMultiSelection,
  },
  actions: {
    // Selection actions
    selectSingle: selectionActions.selectSingle,
    clearSelection: selectionActions.clearSelection,
    setPrimarySelected: selectionActions.setPrimarySelected,
    toggleSelected: selectionActions.toggleSelected,
    selectRange: selectionActions.selectRange,
    selectSiblingRange: selectionActions.selectSiblingRange,
    extendSelectionByOffset: selectionActions.extendSelectionByOffset,
    selectAllSiblings: selectionActions.selectAllSiblings,
    collapseSelectionToPrimary: selectionActions.collapseSelectionToPrimary,
    restoreSelectionSnapshot: selectionActions.restoreSelectionSnapshot,
    // Expansion actions
    expandAncestors: expansionActions.expandAncestors,
    // Mutation actions
    insertFlatNode: mutationActions.insertFlatNode,
    patchBookmark: mutationActions.patchBookmark,
    patchFlatNodes: mutationActions.patchFlatNodes,
    applyMoveResult: mutationActions.applyMoveResult,
    loadFolderChildren: mutationActions.loadFolderChildren,
    // Orchestrator actions
    loadFile,
    refresh,
    revealAndSelectNode,
    toggleExpand,
    restoreUIState,
    /**
     * @param {number} scrollTop
     * @returns {number}
     */
    setTreeScrollTop(scrollTop) {
      if (!Number.isFinite(scrollTop)) {
        return treeScrollTop();
      }
      return treeScrollTop(Math.max(0, scrollTop));
    },
    /**
     * Test/support helper during migration.
     * @param {TreeNode[]} nodes
     * @returns {TreeNode[]}
     */
    setTree(nodes) {
      return tree(nodes);
    },
    /**
     * @param {string} message
     * @returns {string}
     */
    setError(message) {
      return error(message);
    },
  },
  selectors: {
    // Selection selectors
    isSelected: selectionSelectors.isSelected,
    getSelectedNodes: selectionSelectors.getSelectedNodes,
    getPrimarySelectedNode: selectionSelectors.getPrimarySelectedNode,
    canJoinSelection: selectionSelectors.canJoinSelection,
    getSiblingIds: selectionSelectors.getSiblingIds,
    captureSelectionSnapshot: selectionSelectors.captureSelectionSnapshot,
    // Expansion selectors
    isExpanded: expansionSelectors.isExpanded,
    getVisibleNodeEntries: expansionSelectors.getVisibleNodeEntries,
    getVisibleNodeIds: expansionSelectors.getVisibleNodeIds,
    getFolderNodeIds: expansionSelectors.getFolderNodeIds,
    // Simple selectors
    getNode,
    getNodeType,
    getParentNode,
    getParentId,
    getChildIndex,
    getAncestorIds,
    /** @returns {TreeNode[]} */
    getTree() {
      return tree();
    },
    /** @returns {string} */
    getSelectedNodeId() {
      return primarySelectedNodeId();
    },
    /** @returns {string[]} */
    getSelectedNodeIds() {
      return selectedNodeIds();
    },
    /** @returns {string} */
    getSelectionAnchorNodeId() {
      return selectionAnchorNodeId();
    },
    /** @returns {string[]} */
    getExpandedNodeIds() {
      return expandedNodeIds();
    },
    /** @returns {number} */
    getTreeScrollTop() {
      return treeScrollTop();
    },
    /** @returns {number} */
    getScrollRestoreVersion() {
      return scrollRestoreVersion();
    },
    /** @returns {boolean} */
    isLoading() {
      return loading();
    },
    /** @returns {string} */
    getError() {
      return error();
    },
    /** @returns {TreeStats} */
    getTreeStats() {
      return treeStats();
    },
    getPersistentState,
  },
};

/**
 * @param {string} selectedId
 * @param {FlatNode[]} flatTree
 * @returns {string[]}
 */
function getAncestorChainFromFlatTree(selectedId, flatTree) {
  if (!selectedId || !Array.isArray(flatTree) || flatTree.length === 0) {
    return [];
  }

  /** @type {Map<string, FlatNode>} */
  const byId = new Map();
  for (const node of flatTree) {
    if (node.id) {
      byId.set(node.id, node);
    }
  }

  /** @type {string[]} */
  const chain = [];
  /** @type {Set<string>} */
  const visited = new Set();
  let cursor = byId.get(selectedId);
  while (cursor && cursor.parentId && !visited.has(cursor.parentId)) {
    visited.add(cursor.parentId);
    const parent = byId.get(cursor.parentId);
    if (!parent || parent.type !== 0) {
      break;
    }
    chain.push(parent.id);
    cursor = parent;
  }
  chain.reverse();
  return chain;
}
