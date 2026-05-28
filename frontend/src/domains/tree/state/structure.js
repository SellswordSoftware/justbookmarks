// @ts-check

/** @typedef {import("../../../types.js").TreeNode} TreeNode */
/** @typedef {import("../../../types.js").FolderNode} FolderNode */
/** @typedef {import("../../../types.js").VisibleTreeNodeEntry} VisibleTreeNodeEntry */

/**
 * @param {TreeNode} node
 * @returns {boolean}
 */
export function isFolderNode(node) {
  return node.type === 0;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {TreeNode | null}
 */
export function findNode(nodes, id) {
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
 * @param {TreeNode[]} nodes
 * @param {string} childId
 * @returns {FolderNode | null}
 */
export function findParentNode(nodes, childId) {
  for (const node of nodes) {
    if (!isFolderNode(node)) {
      continue;
    }

    if (node.folder.children.some((child) => child.id === childId)) {
      return node;
    }

    const found = findParentNode(node.folder.children, childId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {TreeNode | null}
 */
export function getNodeById(nodes, id) {
  return findNode(nodes, id);
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {0 | 1 | null}
 */
export function getNodeTypeById(nodes, id) {
  const node = getNodeById(nodes, id);
  return node?.type ?? null;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {FolderNode | null}
 */
export function getParentNodeById(nodes, id) {
  return findParentNode(nodes, id);
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {string}
 */
export function getParentIdById(nodes, id) {
  return getParentNodeById(nodes, id)?.id ?? "";
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} parentId
 * @param {string} childId
 * @returns {number}
 */
export function getChildIndexById(nodes, parentId, childId) {
  const parent = getNodeById(nodes, parentId);
  if (!parent || !isFolderNode(parent)) {
    return -1;
  }
  return parent.folder.children.findIndex((child) => child.id === childId);
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {string[]}
 */
export function getAncestorIds(nodes, id) {
  /** @type {string[]} */
  const ancestors = [];
  let currentId = id;

  while (currentId) {
    const parentId = getParentIdById(nodes, currentId);
    if (!parentId) {
      break;
    }
    ancestors.push(parentId);
    currentId = parentId;
  }

  return ancestors;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string} id
 * @returns {string[]}
 */
export function getSiblingIds(nodes, id) {
  if (!id) {
    return [];
  }

  const parent = getParentNodeById(nodes, id);
  if (!parent) {
    return nodes.map((node) => node.id);
  }

  return parent.folder.children.map((child) => child.id);
}

/**
 * @param {TreeNode[]} nodes
 * @param {Iterable<string>} expandedNodeIds
 * @returns {VisibleTreeNodeEntry[]}
 */
export function getVisibleNodeEntries(nodes, expandedNodeIds) {
  return collectVisibleNodeEntries(nodes, new Set(expandedNodeIds));
}

/**
 * @param {TreeNode[]} nodes
 * @param {Set<string>} expandedNodeIds
 * @param {number} [depth=0]
 * @param {string} [parentId=""]
 * @returns {VisibleTreeNodeEntry[]}
 */
function collectVisibleNodeEntries(nodes, expandedNodeIds, depth = 0, parentId = "") {
  /** @type {VisibleTreeNodeEntry[]} */
  const result = [];

  for (const node of nodes) {
    result.push({ id: node.id, node, depth, parentId });
    if (isFolderNode(node) && expandedNodeIds.has(node.id)) {
      result.push(...collectVisibleNodeEntries(node.folder.children ?? [], expandedNodeIds, depth + 1, node.id));
    }
  }

  return result;
}

/**
 * @param {TreeNode[]} nodes
 * @returns {string[]}
 */
export function getFolderNodeIds(nodes) {
  /** @type {string[]} */
  const result = [];
  for (const node of nodes) {
    if (!isFolderNode(node)) {
      continue;
    }
    result.push(node.id);
    result.push(...getFolderNodeIds(node.folder.children));
  }
  return result;
}
