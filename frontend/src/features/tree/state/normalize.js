// @ts-check

/**
 * @typedef {object} RawBookmarkNode
 * @property {1} type
 * @property {{
 *   id?: string,
 *   title?: string,
 *   url?: string,
 *   icon?: string,
 *   iconURI?: string,
 *   addDate?: string,
 *   lastModified?: string,
 *   meta?: string
 * }=} bookmark
 */

/**
 * @typedef {object} RawFolderNode
 * @property {0} type
 * @property {{
 *   id?: string,
 *   name?: string,
 *   icon?: string,
 *   addDate?: string,
 *   lastModified?: string,
 *   meta?: string,
 *   children?: RawTreeNode[]
 * }=} folder
 */

/** @typedef {RawFolderNode | RawBookmarkNode} RawTreeNode */

/**
 * @param {RawTreeNode[] | undefined} nodes
 * @returns {TreeNode[]}
 */
export function normalizeTree(nodes) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .map((node) => normalizeNode(node))
    .filter((node) => node !== null);
}

/**
 * @param {RawTreeNode | null | undefined} node
 * @returns {TreeNode | null}
 */
function normalizeNode(node) {
  if (!node) {
    return null;
  }

  if (node.type === 0 && node.folder?.id) {
    return {
      type: 0,
      id: node.folder.id,
      folder: {
        id: node.folder.id,
        name: node.folder.name ?? "",
        icon: node.folder.icon ?? "",
        addDate: node.folder.addDate ?? "",
        lastModified: node.folder.lastModified ?? "",
        meta: node.folder.meta ?? "",
        children: normalizeTree(node.folder.children),
        childrenLoaded: true,
      },
    };
  }

  if (node.type === 1 && node.bookmark?.id) {
    return {
      type: 1,
      id: node.bookmark.id,
      bookmark: {
        id: node.bookmark.id,
        title: node.bookmark.title ?? "",
        url: node.bookmark.url ?? "",
        icon: node.bookmark.icon ?? "",
        iconURI: node.bookmark.iconURI ?? "",
        addDate: node.bookmark.addDate ?? "",
        lastModified: node.bookmark.lastModified ?? "",
        meta: node.bookmark.meta ?? "",
      },
    };
  }

  return null;
}
