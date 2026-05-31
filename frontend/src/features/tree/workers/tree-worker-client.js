// @ts-check

import { normalizeFlat } from "../state/normalize-flat.js";

/** @typedef {"normalizeFlat" | "buildNodeIndex"} TreeWorkerRequestType */

/** @type {Worker | null} */
let worker = null;
let nextRequestId = 1;

/** @type {Map<number, { resolve: (value: any) => void, reject: (reason?: unknown) => void }>} */
const pendingRequests = new Map();

/** @returns {Worker | null} */
function getWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }
  if (!worker) {
    worker = new Worker(new URL("./tree-worker.js", import.meta.url), { type: "module" });
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
        pending.reject(new Error(response.error || "Tree worker failed"));
      }
    });
    worker.addEventListener("error", (event) => {
      for (const pending of pendingRequests.values()) {
        pending.reject(new Error(event.message || "Tree worker failed"));
      }
      pendingRequests.clear();
      worker?.terminate();
      worker = null;
    });
  }
  return worker;
}

/**
 * @param {TreeWorkerRequestType} type
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
function request(type, payload) {
  const activeWorker = getWorker();
  if (!activeWorker) {
    return Promise.reject(new Error("Worker runtime is unavailable"));
  }

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    activeWorker.postMessage({ id, type, payload });
  });
}

/**
 * @param {FlatNode[] | undefined} flatNodes
 * @returns {Promise<TreeNode[]>}
 */
export async function normalizeFlatInWorker(flatNodes) {
  try {
    return /** @type {TreeNode[]} */ (await request("normalizeFlat", flatNodes));
  } catch {
    return normalizeFlat(flatNodes);
  }
}

/**
 * @param {TreeNode[]} nodes
 * @returns {Promise<{ id: string, type: 0 | 1, parentId: string }[]>}
 */
export async function buildNodeIndexInWorker(nodes) {
  return /** @type {{ id: string, type: 0 | 1, parentId: string }[]} */ (
    await request("buildNodeIndex", nodes)
  );
}

/** @returns {void} */
export function disposeTreeWorker() {
  worker?.terminate();
  worker = null;
  pendingRequests.clear();
}
