// @ts-check

import { computed, signal } from "../../shared/runtime/naf.js";

const open = signal(false);
const request = signal(/** @type {MoveDialogRequest | null} */ (null));
const selectedTarget = signal("");
const treeNodes = signal(/** @type {TreeNode[]} */ ([]));
const expandedFolderIds = signal(/** @type {string[]} */ ([]));
const filterQuery = signal("");
const loadingFolderIds = signal(/** @type {string[]} */ ([]));

/**
 * @typedef {object} FolderRecord
 * @property {string} id
 * @property {string} name
 * @property {string} pathLabel
 * @property {string} parentId
 * @property {number} depth
 * @property {boolean} hasChildren
 */

/**
 * @param {TreeNode} node
 * @returns {node is FolderNode}
 */
function isFolderNode(node) {
  return node.type === 0;
}

/**
 * @param {string[]} ids
 * @returns {Set<string>}
 */
function toSet(ids) {
  return new Set(ids);
}

/**
 * @param {TreeNode[]} nodes
 * @returns {string[]}
 */
function getRootFolderIds(nodes) {
  return nodes
    .filter((node) => isFolderNode(node))
    .map((node) => node.id);
}

/**
 * @param {TreeNode[]} nodes
 * @param {Set<string>} excludedIds
 * @returns {{
 *   records: FolderRecord[],
 *   byId: Map<string, FolderRecord>,
 *   childIdsByParentId: Map<string, string[]>,
 * }}
 */
function buildFolderIndex(nodes, excludedIds) {
  /** @type {FolderRecord[]} */
  const records = [];
  /** @type {Map<string, FolderRecord>} */
  const byId = new Map();
  /** @type {Map<string, string[]>} */
  const childIdsByParentId = new Map();

  /**
   * @param {TreeNode[]} currentNodes
   * @param {string} parentId
   * @param {number} depth
   * @param {string} parentPath
   * @param {boolean} insideExcludedBranch
   */
  function visit(currentNodes, parentId, depth, parentPath, insideExcludedBranch) {
    for (const node of currentNodes) {
      if (!isFolderNode(node)) {
        continue;
      }

      const isExcluded = insideExcludedBranch || excludedIds.has(node.id);
      if (isExcluded) {
        continue;
      }

      const name = node.folder.name || "Untitled folder";
      const pathLabel = parentPath ? `${parentPath} / ${name}` : name;
      const hasChildren = (node.folder.childCount ?? 0) > 0 || node.folder.children.some(
        (child) => isFolderNode(child) && !excludedIds.has(child.id),
      );

      /** @type {FolderRecord} */
      const record = {
        id: node.id,
        name,
        pathLabel,
        parentId,
        depth,
        hasChildren,
      };

      records.push(record);
      byId.set(record.id, record);

      if (!childIdsByParentId.has(parentId)) {
        childIdsByParentId.set(parentId, []);
      }
      childIdsByParentId.get(parentId)?.push(record.id);

      visit(node.folder.children, record.id, depth + 1, pathLabel, isExcluded);
    }
  }

  visit(nodes, "", 0, "", false);

  return {
    records,
    byId,
    childIdsByParentId,
  };
}

const excludedFolderIds = computed(() => {
  const currentRequest = request();
  if (!currentRequest || currentRequest.type !== "folder") {
    return new Set();
  }
  return toSet(currentRequest.nodeIds);
});

const folderIndex = computed(() => buildFolderIndex(treeNodes(), excludedFolderIds()));

const visibleFolders = computed(() => {
  const currentRequest = request();
  if (!currentRequest) {
    return /** @type {MoveTarget[]} */ ([]);
  }

  const expanded = toSet(expandedFolderIds());
  const query = filterQuery().trim().toLowerCase();
  const filtering = query.length > 0;

  const { records, byId, childIdsByParentId } = folderIndex();

  /** @type {Set<string>} */
  const includeIds = new Set();

  if (filtering) {
    for (const record of records) {
      if (
        record.name.toLowerCase().includes(query) ||
        record.pathLabel.toLowerCase().includes(query)
      ) {
        includeIds.add(record.id);
        let cursorParentId = record.parentId;
        while (cursorParentId) {
          includeIds.add(cursorParentId);
          cursorParentId = byId.get(cursorParentId)?.parentId ?? "";
        }
      }
    }
  } else {
    for (const record of records) {
      includeIds.add(record.id);
    }
  }

  /** @type {MoveTarget[]} */
  const result = [];

  /**
   * @param {string} parentId
   */
  function appendVisible(parentId) {
    const childIds = childIdsByParentId.get(parentId) ?? [];
    for (const childId of childIds) {
      if (!includeIds.has(childId)) {
        continue;
      }

      const record = byId.get(childId);
      if (!record) {
        continue;
      }

      const isExpanded = filtering ? true : expanded.has(record.id);
      result.push({
        id: record.id,
        name: record.name,
        depth: record.depth,
        pathLabel: record.pathLabel,
        hasChildren: record.hasChildren,
        expanded: isExpanded,
      });

      if (filtering || isExpanded) {
        appendVisible(record.id);
      }
    }
  }

  appendVisible("");
  return result;
});

export const moveDialogState = {
  signals: {
    open,
    request,
    selectedTarget,
    treeNodes,
    expandedFolderIds,
    filterQuery,
    loadingFolderIds,
  },
  computed: {
    visibleFolders,
  },
  actions: {
    /**
     * @param {TreeNode[]} nodes
     * @returns {TreeNode[]}
     */
    setTreeNodes(nodes) {
      return treeNodes(nodes);
    },
    /**
     * @param {string} targetId
     * @returns {string}
     */
    setSelectedTarget(targetId) {
      return selectedTarget(targetId);
    },
    /**
     * @param {string} nextQuery
     * @returns {string}
     */
    setFilterQuery(nextQuery) {
      return filterQuery(nextQuery);
    },
    /**
     * @param {string} folderId
     * @param {boolean} loading
     * @returns {void}
     */
    setFolderLoading(folderId, loading) {
      const next = new Set(loadingFolderIds());
      if (loading) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      loadingFolderIds([...next]);
    },
    /**
     * @param {string} folderId
     * @returns {void}
     */
    toggleExpanded(folderId) {
      const next = new Set(expandedFolderIds());
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      expandedFolderIds([...next]);
    },
    /**
     * @param {MoveDialogRequest} nextRequest
     * @param {TreeNode[]=} nodes
     * @returns {MoveDialogRequest}
     */
    openDialog(nextRequest, nodes) {
      if (nodes) {
        treeNodes(nodes);
      }
      request(nextRequest);
      selectedTarget("");
      filterQuery("");
      loadingFolderIds([]);
      expandedFolderIds([]);
      open(true);
      return nextRequest;
    },
    /**
     * @param {string} nodeId
     * @param {string} nodeName
     * @param {"bookmark" | "folder"} type
     * @param {TreeNode[]=} nodes
     * @returns {MoveDialogRequest}
     */
    showMoveDialog(nodeId, nodeName, type, nodes) {
      return moveDialogState.actions.openDialog(
        {
          nodeIds: [nodeId],
          label: nodeName,
          type,
        },
        nodes,
      );
    },
    /**
     * @param {string[]} nodeIds
     * @param {"bookmark" | "folder"} type
     * @param {TreeNode[]=} nodes
     * @returns {MoveDialogRequest}
     */
    showBulkMoveDialog(nodeIds, type, nodes) {
      const count = nodeIds.length;
      return moveDialogState.actions.openDialog(
        {
          nodeIds: [...nodeIds],
          label: `${count} ${type}${count === 1 ? "" : "s"}`,
          type,
        },
        nodes,
      );
    },
    /**
     * @returns {void}
     */
    closeMoveDialog() {
      open(false);
      selectedTarget("");
      filterQuery("");
      loadingFolderIds([]);
      request(null);
    },
  },
  selectors: {
    /**
     * @returns {boolean}
     */
    isOpen() {
      return open();
    },
    /**
     * @returns {MoveDialogRequest | null}
     */
    getRequest() {
      return request();
    },
    /**
     * @returns {MoveTarget[]}
     */
    getFolders() {
      return visibleFolders();
    },
    /**
     * @returns {MoveTarget[]}
     */
    getVisibleFolders() {
      return visibleFolders();
    },
    /**
     * @returns {string}
     */
    getSelectedTarget() {
      return selectedTarget();
    },
    /**
     * @returns {string}
     */
    getFilterQuery() {
      return filterQuery();
    },
    /**
     * @param {string} folderId
     * @returns {boolean}
     */
    isExpanded(folderId) {
      return expandedFolderIds().includes(folderId);
    },
    /**
     * @param {string} folderId
     * @returns {boolean}
     */
    isFolderLoading(folderId) {
      return loadingFolderIds().includes(folderId);
    },
  },
};
