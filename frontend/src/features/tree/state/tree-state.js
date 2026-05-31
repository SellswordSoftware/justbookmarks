// @ts-check

import { GetFlatIndex, GetFlatTree, LoadFile } from "../../../shared/api/api.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { computed, signal } from "../../../shared/runtime/naf.js";
import { searchState } from "../../search/state/search-state.js";
import {
  expandAncestorIds,
  getDefaultExpandedFolderIds,
  getFolderNodeIdsFromState,
  getVisibleNodeEntries as getVisibleNodeEntriesFromState,
  getVisibleNodeIds as getVisibleNodeIdsFromState,
  isExpandedId,
  toggleExpandedId,
} from "./expansion.js";
import { normalizeFlat } from "./normalize-flat.js";
import {
  getPersistentTreeState,
  pruneSelectionState,
  restorePersistentTreeState,
} from "./persistence.js";
import {
  canJoinSelection as canJoinSelectionState,
  captureSelectionSnapshot as captureSelectionSnapshotState,
  createEmptySelectionState,
  createSingleSelectionState,
  extendSelectionByOffset as extendSelectionByOffsetState,
  restoreSelectionSnapshot as restoreSelectionSnapshotState,
  selectAllSiblings as selectAllSiblingsState,
  selectRange as selectRangeState,
  toggleSelected as toggleSelectedState,
} from "./selection.js";
import {
  getAncestorIds as getAncestorIdsFromTree,
  getChildIndexById,
  getNodeById,
  getNodeTypeById,
  getParentIdById,
  getParentNodeById,
  getSiblingIds as getSiblingIdsFromTree,
} from "./structure.js";

/** Tree state owner for normalized tree data, selection, expansion, and load/restore workflows. */

/** @typedef {import("./selection.js").SelectionSnapshot} SelectionSnapshot */
/** @type {TreeNode[]} */
const emptyTree = [];
const tree = signal(emptyTree);
const primarySelectedNodeId = signal("");
const selectedNodeIds = signal(/** @type {string[]} */ ([]));
const selectionAnchorNodeId = signal("");
const expandedNodeIds = signal(/** @type {string[]} */ ([]));
const loading = signal(false);
const error = signal("");

const selectionCount = computed(() => selectedNodeIds().length);
const hasMultiSelection = computed(() => selectedNodeIds().length > 1);

/**
 * Flat Map index for O(1) node lookups.
 * Rebuilt whenever the tree signal changes.
 * @type {Computed<Map<string, TreeNode>>}
 */
const nodeIndex = computed(() => {
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
});

/**
 * Set of selected node IDs for O(1) membership tests.
 * Rebuilt whenever selectedNodeIds changes.
 * @type {Computed<Set<string>>}
 */
const selectedNodeIdsSet = computed(() => new Set(selectedNodeIds()));

/**
 * @param {string} id
 * @returns {TreeNode | null}
 */
function getNode(id) {
  return nodeIndex().get(id) ?? null;
}

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
 * @returns {boolean}
 */
function isSelected(id) {
  return selectedNodeIdsSet().has(id);
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
 * @returns {void}
 */
function setPrimarySelected(id) {
  if (!id || !selectedNodeIds().includes(id)) {
    return;
  }
  primarySelectedNodeId(id);
}

/** @returns {void} */
function clearSelection() {
  applySelectionState(createEmptySelectionState());
}

/**
 * @param {string} id
 * @returns {string[]}
 */
function getAncestorIds(id) {
  return getAncestorIdsFromTree(tree(), id);
}

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
 * @param {string} id
 * @returns {string[]}
 */
function getSiblingIds(id) {
  return getSiblingIdsFromTree(tree(), id);
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
 * @param {string} id
 * @returns {void}
 */
function expandAncestors(id) {
  expandedNodeIds(expandAncestorIds(expandedNodeIds(), getAncestorIds(id)));
}

/**
 * @param {string} id
 * @returns {void}
 */
function toggleExpand(id) {
  expandedNodeIds(toggleExpandedId(expandedNodeIds(), id));
}

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

/** @returns {void} */
function pruneSelection() {
  applySelectionState(pruneSelectionState(tree(), getSelectionState()));
}

/** @returns {Promise<void>} */
async function syncTreeState() {
  const [flatData, flatIndex] = await Promise.all([GetFlatTree(), GetFlatIndex()]);
  tree(normalizeFlat(flatData));
  searchState.actions.setIndex(flatIndex);
  pruneSelection();
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function loadFile(path) {
  loading(true);
  error("");
  try {
    await LoadFile(path);
    expandedNodeIds([]);
    clearSelection();
    await syncTreeState();
    expandedNodeIds(getDefaultExpandedFolderIds(tree()));
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
 * @returns {void}
 */
function restoreUIState(state) {
  const nextState = restorePersistentTreeState(tree(), state);
  expandedNodeIds(nextState.expandedNodeIds);
  applySelectionState(nextState.selectionState);
}

/** @returns {PerFileTreeState} */
function getPersistentState() {
  return getPersistentTreeState(expandedNodeIds(), primarySelectedNodeId());
}

/** @returns {SelectionSnapshot} */
function captureSelectionSnapshot() {
  return captureSelectionSnapshotState(tree(), selectedNodeIds(), primarySelectedNodeId());
}

/**
 * @param {SelectionSnapshot | null | undefined} snapshot
 * @returns {void}
 */
function restoreSelectionSnapshot(snapshot) {
  applySelectionState(restoreSelectionSnapshotState(tree(), snapshot));
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

/** @returns {Promise<void>} */
async function refresh() {
  await syncTreeState();
}

export const treeState = {
  signals: {
    tree,
    primarySelectedNodeId,
    selectedNodeIds,
    selectionAnchorNodeId,
    expandedNodeIds,
    loading,
    error,
  },
  computed: {
    selectionCount,
    hasMultiSelection,
  },
  actions: {
    loadFile,
    refresh,
    selectNode: selectSingle,
    selectSingle,
    toggleSelected,
    selectRange,
    clearSelection,
    setPrimarySelected,
    toggleExpand,
    restoreUIState,
    restoreSelectionSnapshot,
    collapseSelectionToPrimary,
    expandAncestors,
    selectSiblingRange,
    extendSelectionByOffset,
    selectAllSiblings,
    /**
     * Test/support helper during migration.
     *
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
    isExpanded,
    isSelected,
    getNode,
    getNodeType,
    getParentNode,
    getParentId,
    getChildIndex,
    getSelectedNodes,
    getPrimarySelectedNode,
    canJoinSelection,
    getSiblingIds,
    getVisibleNodeEntries,
    getVisibleNodeIds,
    captureSelectionSnapshot,
    getPersistentState,
    getAncestorIds,
    getFolderNodeIds,
    /**
     * @returns {TreeNode[]}
     */
    getTree() {
      return tree();
    },
    /**
     * @returns {string}
     */
    getSelectedNodeId() {
      return primarySelectedNodeId();
    },
    /**
     * @returns {string[]}
     */
    getSelectedNodeIds() {
      return selectedNodeIds();
    },
    /**
     * @returns {string}
     */
    getSelectionAnchorNodeId() {
      return selectionAnchorNodeId();
    },
    /**
     * @returns {string[]}
     */
    getExpandedNodeIds() {
      return expandedNodeIds();
    },
    /**
     * @returns {boolean}
     */
    isLoading() {
      return loading();
    },
    /**
     * @returns {string}
     */
    getError() {
      return error();
    },
  },
};
