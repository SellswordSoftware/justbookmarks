// @ts-check

/** @type {Worker | null} */
let worker = null;
let nextRequestId = 1;

/** @type {Map<number, { resolve: (value: any) => void, reject: (reason?: unknown) => void }>} */
const pendingRequests = new Map();

/**
 * @param {TreeNode[]} nodes
 * @returns {BookmarkIndexEntry[]}
 */
function buildIndexSync(nodes) {
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

/** @returns {Worker | null} */
function getWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }
  if (!worker) {
    worker = new Worker(new URL("./search-worker.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event) => {
      const response = /** @type {{ id: number, ok: boolean, result?: unknown, error?: string }} */ (
        event.data
      );
      const pending = pendingRequests.get(response.id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(response.id);
      if (response.ok) {
        pending.resolve(response.result);
      } else {
        pending.reject(new Error(response.error || "Search worker failed"));
      }
    });
    worker.addEventListener("error", (event) => {
      for (const pending of pendingRequests.values()) {
        pending.reject(new Error(event.message || "Search worker failed"));
      }
      pendingRequests.clear();
      worker?.terminate();
      worker = null;
    });
  }
  return worker;
}

/**
 * @param {TreeNode[]} nodes
 * @returns {Promise<BookmarkIndexEntry[]>}
 */
export async function buildSearchIndexInWorker(nodes) {
  const activeWorker = getWorker();
  if (!activeWorker) {
    return buildIndexSync(nodes);
  }

  const id = nextRequestId++;
  try {
    return /** @type {BookmarkIndexEntry[]} */ (
      await new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        activeWorker.postMessage({ id, type: "buildIndex", payload: nodes });
      })
    );
  } catch {
    return buildIndexSync(nodes);
  }
}

/** @returns {void} */
export function disposeSearchWorker() {
  worker?.terminate();
  worker = null;
  pendingRequests.clear();
}
