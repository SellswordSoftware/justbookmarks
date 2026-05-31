// @ts-check

import { normalizeFlat } from "../state/normalize-flat.js";

/**
 * @typedef {{
 *   id: number,
 *   type: "normalizeFlat" | "buildNodeIndex",
 *   payload: unknown,
 * }} TreeWorkerRequest
 */

/**
 * @typedef {{
 *   id: number,
 *   ok: boolean,
 *   result?: unknown,
 *   error?: string,
 * }} TreeWorkerResponse
 */

/**
 * @param {TreeNode[]} nodes
 * @returns {{ id: string, type: 0 | 1, parentId: string }[]}
 */
function buildNodeIndex(nodes) {
  /** @type {{ id: string, type: 0 | 1, parentId: string }[]} */
  const entries = [];
  /** @type {{ nodes: TreeNode[], parentId: string }[]} */
  const stack = [{ nodes, parentId: "" }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const node of current.nodes) {
      entries.push({ id: node.id, type: node.type, parentId: current.parentId });
      if (node.type === 0 && node.folder.children.length > 0) {
        stack.push({ nodes: node.folder.children, parentId: node.id });
      }
    }
  }

  return entries;
}

self.addEventListener("message", (event) => {
  const request = /** @type {TreeWorkerRequest} */ (event.data);

  try {
    /** @type {unknown} */
    let result;

    switch (request.type) {
      case "normalizeFlat":
        result = normalizeFlat(/** @type {FlatNode[]} */ (request.payload));
        break;
      case "buildNodeIndex":
        result = buildNodeIndex(/** @type {TreeNode[]} */ (request.payload));
        break;
      default:
        throw new Error(`Unknown tree worker request: ${request.type}`);
    }

    /** @type {TreeWorkerResponse} */
    const response = { id: request.id, ok: true, result };
    self.postMessage(response);
  } catch (caughtError) {
    /** @type {TreeWorkerResponse} */
    const response = {
      id: request.id,
      ok: false,
      error: caughtError instanceof Error ? caughtError.message : String(caughtError),
    };
    self.postMessage(response);
  }
});
