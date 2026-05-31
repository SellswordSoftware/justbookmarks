// @ts-check

import { computed, signal } from "../../shared/runtime/naf.js";

/**
 * Move dialog state owner.
 *
 * Owns:
 * - dialog open/closed state
 * - current move request
 * - valid folder targets derived from tree data
 * - excluded-descendant logic for folder moves
 */

const open = signal(false);
const request = signal(/** @type {MoveDialogRequest | null} */ (null));
const selectedTarget = signal("");
const treeNodes = signal(/** @type {TreeNode[]} */ ([]));

/**
 * @param {TreeNode} node
 * @returns {node is FolderNode}
 */
function isFolderNode(node) {
  return node.type === 0;
}

/**
 * @param {TreeNode[]} nodes
 * @param {string[]} excludedIds
 * @returns {MoveTarget[]}
 */
function collectFolderTargets(nodes, excludedIds) {
  /** @type {MoveTarget[]} */
  const result = [];
  const excludedIdSet = new Set(excludedIds);

  /**
   * @param {TreeNode} node
   * @param {boolean} [insideExcludedBranch=false]
   * @param {number} [depth=0]
   * @param {string} [parentPath=""]
   * @returns {void}
   */
  function visit(node, insideExcludedBranch = false, depth = 0, parentPath = "") {
    if (!isFolderNode(node)) {
      return;
    }

    const isExcludedBranch = insideExcludedBranch || excludedIdSet.has(node.id);
    const pathLabel = parentPath ? `${parentPath} / ${node.folder.name}` : node.folder.name;

    if (!isExcludedBranch) {
      result.push({
        id: node.id,
        name: node.folder.name,
        depth,
        pathLabel,
      });
    }

    for (const child of node.folder.children) {
      visit(child, isExcludedBranch, depth + 1, pathLabel);
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return result;
}

const folders = computed(() => {
  const currentRequest = request();
  if (!currentRequest) {
    return /** @type {MoveTarget[]} */ ([]);
  }

  const excludedIds = currentRequest.type === "folder" ? currentRequest.nodeIds : [];
  return collectFolderTargets(treeNodes(), excludedIds);
});

export const moveDialogState = {
  signals: {
    open,
    request,
    selectedTarget,
    treeNodes,
  },
  computed: {
    folders,
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
      return folders();
    },
    /**
     * @returns {string}
     */
    getSelectedTarget() {
      return selectedTarget();
    },
  },
};
