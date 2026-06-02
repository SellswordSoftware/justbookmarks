// @ts-check

import { GetFlatIndex, GetFolderChildren } from "../../../shared/api/api.js";
import { searchState } from "../../search/state/search-state.js";
import { normalizeFlatInWorker } from "../workers/tree-worker-client.js";
import {
  tree,
  expandedNodeIds,
  nodeIndex,
} from "./tree-state.js";

/** Tree mutation actions. */

/**
 * @param {string} id
 * @returns {TreeNode | null}
 */
function getNode(id) {
  return nodeIndex().get(id) ?? null;
}

/**
 * @param {string} id
 * @returns {string[]}
 */
function getAncestorIds(id) {
  /** @type {string[]} */
  const ancestors = [];
  let currentId = id;

  while (currentId) {
    const parentNode = findParent(tree(), currentId);
    if (!parentNode) {
      break;
    }
    ancestors.push(parentNode.id);
    currentId = parentNode.id;
  }

  return ancestors;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} childId
 * @returns {FolderNode | null}
 */
function findParent(nodes, childId) {
  for (const node of nodes) {
    if (!isFolderNode(node)) {
      continue;
    }

    if (node.folder.children.some((child) => child.id === childId)) {
      return node;
    }

    const found = findParent(node.folder.children, childId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * @param {TreeNode} node
 * @returns {node is FolderNode}
 */
function isFolderNode(node) {
  return node.type === 0;
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
        childCount: flatNode.childCount ?? 0,
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

// --- Actions ---

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
    await syncSearchIndex();
  } else {
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
  const currentTree = tree();
  const folderInTree = findNode(currentTree, folderId);
  if (folderInTree && folderInTree.type === 0) {
    folderInTree.folder.children = normalized;
    folderInTree.folder.childCount = normalized.length;
    folderInTree.folder.childrenLoaded = true;
    tree([...currentTree]);
  }
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {TreeNode | null}
 */
function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (isFolderNode(node)) {
      const found = findNode(node.folder.children, id);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Refresh only the search index from Go without reloading the tree.
 * @returns {Promise<void>}
 */
async function syncSearchIndex() {
  const flatIndex = await GetFlatIndex();
  searchState.actions.setIndex(flatIndex);
}

// --- Exports ---

/** @type {Record<string, Function>} */
export const mutationActions = {
  insertFlatNode,
  patchBookmark,
  patchFlatNodes,
  applyMoveResult,
  loadFolderChildren,
};
