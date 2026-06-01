// @ts-check

import { GetFlatIndex, GetFlatTree, GetFolderChildren, GetRootNodes, GetTreeStats, LoadFile } from "../../../shared/api/api.js";
import { getErrorMessage } from "../../../shared/infra/errors.js";
import { computed, signal } from "../../../shared/runtime/naf.js";
import { searchState } from "../../search/state/search-state.js";
import { buildSearchIndexInWorker } from "../../search/workers/search-worker-client.js";
import {
  expandAncestorIds,
  getDefaultExpandedFolderIds,
  getFolderNodeIdsFromState,
  getVisibleNodeEntries as getVisibleNodeEntriesFromState,
  getVisibleNodeIds as getVisibleNodeIdsFromState,
  isExpandedId,
  toggleExpandedId,
} from "./expansion.js";
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
import { normalizeFlatInWorker } from "../workers/tree-worker-client.js";

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
const treeStats = signal(/** @type {TreeStats} */ ({ folders: 0, bookmarks: 0 }));

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
  const node = getNode(id);
  if (!node || node.type !== 0) {
    return;
  }
  const currentlyExpanded = isExpanded(id);
  const childrenLoaded = node.folder.childrenLoaded;

  // Collapsed and not loaded: load children then expand
  if (!currentlyExpanded && !childrenLoaded) {
    loadFolderChildren(id).then(() => {
      expandedNodeIds(toggleExpandedId(expandedNodeIds(), id));
    });
    return;
  }

  // Expanded but not loaded (auto-expanded on initial load): load children, keep expanded
  if (currentlyExpanded && !childrenLoaded) {
    loadFolderChildren(id);
    return;
  }

  // Normal toggle (children are loaded)
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

/**
 * @param {FlatNode} flatNode
 * @returns {TreeNode | null}
 */
function createTreeNodeFromFlatNode(flatNode) {
  if (!flatNode.id) {
    return null;
  }

  if (flatNode.type === 0) {
    return {
      type: 0,
      id: flatNode.id,
      folder: {
        id: flatNode.id,
        name: flatNode.name ?? "",
        icon: flatNode.icon ?? "",
        addDate: flatNode.addDate ?? "",
        lastModified: flatNode.lastModified ?? "",
        meta: flatNode.meta ?? "",
        children: [],
        childrenLoaded: (flatNode.childCount ?? 0) === 0,
      },
    };
  }

  return {
    type: 1,
    id: flatNode.id,
    bookmark: {
      id: flatNode.id,
      title: flatNode.name ?? "",
      url: flatNode.url ?? "",
      icon: flatNode.icon ?? "",
      iconURI: flatNode.iconURI ?? "",
      addDate: flatNode.addDate ?? "",
      lastModified: flatNode.lastModified ?? "",
      meta: flatNode.meta ?? "",
    },
  };
}

/**
 * @param {string} folderId
 * @returns {string | null}
 */
function getLoadedFolderPath(folderId) {
  if (!folderId) {
    return "";
  }

  const names = [];
  const folder = getNode(folderId);
  if (!folder || folder.type !== 0) {
    return null;
  }
  names.push(folder.folder.name);

  for (const ancestorId of getAncestorIds(folderId)) {
    const ancestor = getNode(ancestorId);
    if (ancestor && ancestor.type === 0) {
      names.push(ancestor.folder.name);
    }
  }

  return names.reverse().join(" / ");
}

/**
 * Insert a flat node into the loaded lazy tree without a full refresh.
 * @param {string} parentId
 * @param {FlatNode} flatNode
 * @param {number} [index]
 * @returns {boolean}
 */
function insertFlatNode(parentId, flatNode, index) {
  const node = createTreeNodeFromFlatNode(flatNode);
  if (!node) {
    return false;
  }

  /** @type {TreeNode[]} */
  let targetChildren;
  if (!parentId) {
    targetChildren = tree();
  } else {
    const parent = getNode(parentId);
    if (!parent || parent.type !== 0) {
      return false;
    }
    if (!parent.folder.childrenLoaded) {
      return true;
    }
    targetChildren = parent.folder.children;
  }

  const insertIndex = typeof index === "number" && index >= 0
    ? Math.min(index, targetChildren.length)
    : targetChildren.length;
  targetChildren.splice(insertIndex, 0, node);

  if (node.type === 1) {
    searchState.actions.addBookmark({
      nodeId: node.id,
      title: node.bookmark.title,
      url: node.bookmark.url,
      folderPath: getLoadedFolderPath(parentId) ?? "",
    });
  }

  tree([...tree()]);
  return true;
}

/**
 * Patch a bookmark already present in the loaded frontend tree without
 * reloading the whole bookmark file.
 * @param {string} id
 * @param {BookmarkPatch} patch
 * @param {boolean} [notify=true]
 * @returns {boolean}
 */
function patchBookmark(id, patch, notify = true) {
  const node = getNode(id);
  if (!node || node.type !== 1) {
    return false;
  }

  if (patch.title !== undefined) {
    node.bookmark.title = patch.title;
  }
  if (patch.url !== undefined) {
    node.bookmark.url = patch.url;
  }
  if (patch.icon !== undefined) {
    node.bookmark.icon = patch.icon;
  }
  if (patch.iconURI !== undefined) {
    node.bookmark.iconURI = patch.iconURI;
  }
  if (patch.meta !== undefined) {
    node.bookmark.meta = patch.meta;
  }

  searchState.actions.patchBookmark(id, patch);
  if (notify) {
    tree([...tree()]);
  }
  return true;
}

/**
 * Patch loaded frontend bookmarks from flat DTOs returned by targeted backend updates.
 * @param {FlatNode[] | null | undefined} flatNodes
 * @returns {number}
 */
function patchFlatNodes(flatNodes) {
  if (!Array.isArray(flatNodes) || flatNodes.length === 0) {
    return 0;
  }

  let patchedCount = 0;
  for (const flatNode of flatNodes) {
    if (flatNode.type !== 1) {
      continue;
    }
    const patched = patchBookmark(
      flatNode.id,
      {
        title: flatNode.name,
        url: flatNode.url,
        icon: flatNode.icon,
        iconURI: flatNode.iconURI,
        meta: flatNode.meta,
      },
      false,
    );
    if (patched) {
      patchedCount++;
    }
  }

  if (patchedCount > 0) {
    tree([...tree()]);
  }
  return patchedCount;
}

/**
 * @param {string} parentId
 * @returns {TreeNode[] | null}
 */
function getLoadedChildrenForParent(parentId) {
  if (!parentId) {
    return tree();
  }

  const parent = getNode(parentId);
  if (!parent || parent.type !== 0 || !parent.folder.childrenLoaded) {
    return null;
  }
  return parent.folder.children;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} nodeId
 * @returns {TreeNode | null}
 */
function removeNodeFromChildren(nodes, nodeId) {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) {
    return null;
  }
  const [removed] = nodes.splice(index, 1);
  return removed ?? null;
}

/**
 * @param {MoveResult} result
 * @returns {Promise<boolean>}
 */
async function applyMoveResult(result) {
  if (!result || !Array.isArray(result.movedNodes) || result.movedNodes.length === 0) {
    return false;
  }

  const oldChildren = getLoadedChildrenForParent(result.oldParentId);
  const newChildren = getLoadedChildrenForParent(result.newParentId);
  /** @type {TreeNode[]} */
  const movedNodes = [];
  let touchedLoadedTree = false;
  let hasFolderMove = false;

  for (const flatNode of result.movedNodes) {
    if (flatNode.type === 0) {
      hasFolderMove = true;
    }
    let movedNode = oldChildren ? removeNodeFromChildren(oldChildren, flatNode.id) : null;
    if (movedNode) {
      touchedLoadedTree = true;
    }
    if (!movedNode) {
      movedNode = getNode(flatNode.id) ?? createTreeNodeFromFlatNode(flatNode);
    }
    if (movedNode) {
      movedNodes.push(movedNode);
    }
  }

  if (newChildren && movedNodes.length > 0) {
    const insertIndex = result.newIndex >= 0
      ? Math.min(result.newIndex, newChildren.length)
      : newChildren.length;
    newChildren.splice(insertIndex, 0, ...movedNodes);
    touchedLoadedTree = true;
  }

  if (!touchedLoadedTree) {
    return false;
  }

  if (hasFolderMove) {
    // Folder move: descendants' folderPath changed in search index.
    // Fetch a fresh search index from Go instead of trying to patch
    // every descendant bookmark individually.
    await syncSearchIndex();
  } else {
    // Pure bookmark move: patch search index entries for the moved bookmarks.
    const nextFolderPath = getLoadedFolderPath(result.newParentId);
    for (const movedNode of movedNodes) {
      if (movedNode.type === 1 && nextFolderPath !== null) {
        searchState.actions.patchBookmarkFolderPath(movedNode.id, nextFolderPath);
      }
    }
  }

  tree([...tree()]);
  return true;
}

/**
 * Load children for a folder that hasn't been loaded yet.
 * Finds the folder node, fetches its children from Go, normalizes them,
 * and patches the folder's children array + marks it as loaded.
 * @param {string} folderId
 * @returns {Promise<void>}
 */
async function loadFolderChildren(folderId) {
  const folder = getNode(folderId);
  if (!folder || folder.type !== 0) {
    return;
  }
  if (folder.folder.childrenLoaded) {
    return;
  }
  const flatChildren = await GetFolderChildren(folderId);
  const normalized = await normalizeFlatInWorker(flatChildren);
  // Patch the folder node in place -- signal will notify because tree() content changed
  const currentTree = tree();
  const folderInTree = getNodeById(currentTree, folderId);
  if (folderInTree && folderInTree.type === 0) {
    folderInTree.folder.children = normalized;
    folderInTree.folder.childrenLoaded = true;
    tree([...currentTree]);
  }
}

/**
 * Sync the full tree state from Go. Used for initial load and after mutations.
 * @returns {Promise<void>}
 */
async function syncTreeState() {
  const [flatData, stats] = await Promise.all([GetFlatTree(), GetTreeStats()]);
  const normalized = await normalizeFlatInWorker(flatData);
  tree(normalized);
  searchState.actions.setIndex(await buildSearchIndexInWorker(normalized));
  treeStats(stats);
  pruneSelection();
}

/** @returns {Promise<void>} */
async function syncRootNodes() {
  const [rootNodes, flatIndex, stats] = await Promise.all([GetRootNodes(), GetFlatIndex(), GetTreeStats()]);
  tree(await normalizeFlatInWorker(rootNodes));
  searchState.actions.setIndex(flatIndex);
  treeStats(stats);
  pruneSelection();
}

/**
 * Refresh only the search index from Go without reloading the tree.
 * Used after folder moves to keep search metadata correct without
 * the cost of a full tree refresh.
 * @returns {Promise<void>}
 */
async function syncSearchIndex() {
  const flatIndex = await GetFlatIndex();
  searchState.actions.setIndex(flatIndex);
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
    await syncRootNodes();
    // Don't auto-expand root folders on initial load with lazy loading.
    // Users expand folders as needed; children load on demand.
    // expandedNodeIds(getDefaultExpandedFolderIds(tree()));
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
    insertFlatNode,
    patchBookmark,
    patchFlatNodes,
    applyMoveResult,
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
    /**
     * @returns {TreeStats}
     */
    getTreeStats() {
      return treeStats();
    },
  },
};
