// @ts-check

/**
 * Convert a flat array of nodes (with parentId references) into the
 * nested TreeNode[] structure expected by the rest of the frontend.
 *
 * Algorithm:
 *  1. Iterate flat array, build each node object
 *  2. Maintain a Map<parentId, parentNode> as we go
 *  3. Push each node into its parent's children array
 *  4. Root-level nodes (parentId === "") go into the root array
 */

/**
 * @param {FlatNode[] | undefined} flatNodes
 * @returns {TreeNode[]}
 */
export function normalizeFlat(flatNodes) {
  if (!Array.isArray(flatNodes) || flatNodes.length === 0) {
    return [];
  }

  /** @type {TreeNode[]} */
  const root = [];

  // Map from parentId to the parent TreeNode for fast lookup
  /** @type {Map<string, TreeNode>} */
  const byId = new Map();

  for (const flat of flatNodes) {
    let node;

    if (flat.type === 0) {
      /** @type {FolderNode} */
      const folderNode = {
        type: 0,
        id: flat.id,
        folder: {
          id: flat.id,
          name: flat.name ?? "",
          icon: flat.icon ?? "",
          addDate: flat.addDate ?? "",
          lastModified: flat.lastModified ?? "",
          meta: flat.meta ?? "",
          children: [],
          childrenLoaded: false,
        },
      };
      node = folderNode;
    } else {
      /** @type {BookmarkNode} */
      const bookmarkNode = {
        type: 1,
        id: flat.id,
        bookmark: {
          id: flat.id,
          title: flat.name ?? "",
          url: flat.url ?? "",
          icon: flat.icon ?? "",
          iconURI: flat.iconURI ?? "",
          addDate: flat.addDate ?? "",
          lastModified: flat.lastModified ?? "",
          meta: flat.meta ?? "",
        },
      };
      node = bookmarkNode;
    }

    byId.set(flat.id, node);

    if (flat.parentId === "") {
      root.push(node);
    } else {
      const parent = byId.get(flat.parentId);
      if (parent && parent.type === 0) {
        parent.folder.children.push(node);
      } else {
        // Parent not yet processed (shouldn't happen with correct ordering)
        // Fall back to root to avoid data loss
        root.push(node);
      }
    }
  }

  return root;
}
