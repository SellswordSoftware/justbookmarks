// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual } from "../lib/assert.js";
import { normalizeFlat } from "../../src/features/tree/state/normalize-flat.js";
import { createStandardFlatNodes, createFolder, createBookmark } from "../fixtures/tree-data.js";

/**
 * Test the pure logic used by tree-worker.js.
 * The worker wraps these functions in self.addEventListener,
 * but the underlying logic is importable and testable here.
 */

describe("tree-worker normalizeFlat", () => {
  test("handles standard flat nodes", () => {
    const result = normalizeFlat(createStandardFlatNodes());
    equal(result.length, 2);
    strictEqual(result[0].type, 0);
    strictEqual(result[1].type, 0);
  });

  test("preserves hierarchy", () => {
    const result = normalizeFlat(createStandardFlatNodes());
    const work = result.find((n) => n.id === "f-work");
    ok(work !== undefined);
    equal(work.folder.children.length, 2);
  });

  test("handles empty input", () => {
    deepEqual(normalizeFlat([]), []);
  });
});

/**
 * Replicate buildNodeIndex logic from tree-worker.js for testing.
 * The worker does not export this function, so we inline it here.
 *
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

describe("buildNodeIndex", () => {
  test("returns entries for all nodes", () => {
    const tree = [
      createFolder(
        { id: "f-root" },
        [
          createBookmark({ id: "bm-1" }),
          createBookmark({ id: "bm-2" }),
        ],
      ),
    ];
    const entries = buildNodeIndex(tree);
    equal(entries.length, 3);
  });

  test("includes correct type and parentId", () => {
    const tree = [
      createFolder(
        { id: "f-root" },
        [createBookmark({ id: "bm-1" })],
      ),
    ];
    const entries = buildNodeIndex(tree);

    const root = entries.find((e) => e.id === "f-root");
    ok(root !== undefined);
    strictEqual(root.type, 0);
    strictEqual(root.parentId, "");

    const bm = entries.find((e) => e.id === "bm-1");
    ok(bm !== undefined);
    strictEqual(bm.type, 1);
    strictEqual(bm.parentId, "f-root");
  });

  test("handles nested hierarchies", () => {
    const tree = [
      createFolder(
        { id: "f-root" },
        [
          createFolder(
            { id: "f-child" },
            [createBookmark({ id: "bm-deep" })],
          ),
        ],
      ),
    ];
    const entries = buildNodeIndex(tree);
    equal(entries.length, 3);

    const deep = entries.find((e) => e.id === "bm-deep");
    ok(deep !== undefined);
    strictEqual(deep.parentId, "f-child");
  });

  test("returns empty for empty tree", () => {
    deepEqual(buildNodeIndex([]), []);
  });

  test("skips folders with no children", () => {
    const tree = [createFolder({ id: "f-empty" })];
    const entries = buildNodeIndex(tree);
    equal(entries.length, 1);
    strictEqual(entries[0].id, "f-empty");
  });
});
