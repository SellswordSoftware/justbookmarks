// @ts-check

/**
 * Reusable test fixtures for tree data structures.
 */

/**
 * Create a bookmark node fixture.
 * @param {Partial<BookmarkData>} [overrides]
 * @returns {BookmarkNode}
 */
export function createBookmark(overrides = {}) {
  return {
    type: 1,
    id: overrides.id ?? "bm-1",
    bookmark: {
      id: overrides.id ?? "bm-1",
      title: overrides.title ?? "Test Bookmark",
      url: overrides.url ?? "https://example.com",
      icon: overrides.icon ?? "",
      iconURI: overrides.iconURI ?? "",
      addDate: overrides.addDate ?? "",
      lastModified: overrides.lastModified ?? "",
      meta: overrides.meta ?? "",
    },
  };
}

/**
 * Create a folder node fixture.
 * @param {Partial<FolderData>} [overrides]
 * @param {TreeNode[]} [children]
 * @returns {FolderNode}
 */
export function createFolder(overrides = {}, children = []) {
  return {
    type: 0,
    id: overrides.id ?? "f-1",
    folder: {
      id: overrides.id ?? "f-1",
      name: overrides.name ?? "Test Folder",
      icon: overrides.icon ?? "",
      addDate: overrides.addDate ?? "",
      lastModified: overrides.lastModified ?? "",
      meta: overrides.meta ?? "",
      children,
      childCount: overrides.childCount ?? children.length,
      childrenLoaded: overrides.childrenLoaded ?? true,
    },
  };
}

/**
 * Create a standard two-level tree fixture:
 *   root/
 *     Work/
 *       GitHub
 *       Google
 *     Personal/
 *       Reddit
 * @returns {TreeNode[]}
 */
export function createStandardTree() {
  return [
    createFolder(
      { id: "f-work", name: "Work" },
      [
        createBookmark({ id: "bm-github", title: "GitHub", url: "https://github.com" }),
        createBookmark({ id: "bm-google", title: "Google", url: "https://google.com" }),
      ],
    ),
    createFolder(
      { id: "f-personal", name: "Personal" },
      [
        createBookmark({ id: "bm-reddit", title: "Reddit", url: "https://reddit.com" }),
      ],
    ),
  ];
}

/**
 * Create a flat node fixture.
 * @param {Partial<FlatNode>} [overrides]
 * @returns {FlatNode}
 */
export function createFlatNode(overrides = {}) {
  return {
    id: overrides.id ?? "node-1",
    type: overrides.type ?? 1,
    parentId: overrides.parentId ?? "",
    name: overrides.name ?? "Test",
    url: overrides.url ?? "https://example.com",
    icon: overrides.icon ?? "",
    iconURI: overrides.iconURI ?? "",
    addDate: overrides.addDate ?? "",
    lastModified: overrides.lastModified ?? "",
    meta: overrides.meta ?? "",
    childCount: overrides.childCount ?? 0,
  };
}

/**
 * Create flat nodes matching createStandardTree().
 * @returns {FlatNode[]}
 */
export function createStandardFlatNodes() {
  return [
    createFlatNode({ id: "f-work", type: 0, name: "Work", parentId: "", childCount: 2, url: "" }),
    createFlatNode({ id: "f-personal", type: 0, name: "Personal", parentId: "", childCount: 1, url: "" }),
    createFlatNode({ id: "bm-github", name: "GitHub", parentId: "f-work", url: "https://github.com" }),
    createFlatNode({ id: "bm-google", name: "Google", parentId: "f-work", url: "https://google.com" }),
    createFlatNode({ id: "bm-reddit", name: "Reddit", parentId: "f-personal", url: "https://reddit.com" }),
  ];
}

/**
 * Create a selection state fixture.
 * @param {string[]} selectedIds
 * @param {string} [primaryId]
 * @param {string} [anchorId]
 */
export function createSelectionState(selectedIds, primaryId, anchorId) {
  return {
    selectedNodeIds: selectedIds,
    primarySelectedNodeId: primaryId ?? selectedIds[0] ?? "",
    selectionAnchorNodeId: anchorId ?? selectedIds[0] ?? "",
  };
}
