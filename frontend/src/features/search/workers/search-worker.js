// @ts-check

/**
 * @typedef {{
 *   id: number,
 *   type: "buildIndex",
 *   payload: unknown,
 * }} SearchWorkerRequest
 */

/**
 * @typedef {{
 *   id: number,
 *   ok: boolean,
 *   result?: unknown,
 *   error?: string,
 * }} SearchWorkerResponse
 */

/**
 * @param {TreeNode[]} nodes
 * @returns {BookmarkIndexEntry[]}
 */
function buildIndex(nodes) {
  /** @type {BookmarkIndexEntry[]} */
  const entries = [];
  /** @type {{ node: TreeNode, path: string[] }[]} */
  const stack = [];

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    stack.push({ node: nodes[index], path: [] });
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const { node, path } = current;
    if (node.type === 0) {
      const childPath = [...path, node.folder.name];
      for (let index = node.folder.children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: node.folder.children[index], path: childPath });
      }
    } else {
      entries.push({
        nodeId: node.id,
        title: node.bookmark.title,
        url: node.bookmark.url,
        folderPath: path.join(" / "),
      });
    }
  }

  return entries;
}

self.addEventListener("message", (event) => {
  const request = /** @type {SearchWorkerRequest} */ (event.data);

  try {
    if (request.type !== "buildIndex") {
      throw new Error(`Unknown search worker request: ${request.type}`);
    }

    /** @type {SearchWorkerResponse} */
    const response = {
      id: request.id,
      ok: true,
      result: buildIndex(/** @type {TreeNode[]} */ (request.payload)),
    };
    self.postMessage(response);
  } catch (caughtError) {
    /** @type {SearchWorkerResponse} */
    const response = {
      id: request.id,
      ok: false,
      error: caughtError instanceof Error ? caughtError.message : String(caughtError),
    };
    self.postMessage(response);
  }
});
