// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual, notOk } from "../lib/assert.js";
import {
  isFolderNode,
  getNodeById,
  getParentNodeById,
  getParentIdById,
  getChildIndexById,
  getAncestorIds,
  getSiblingIds,
  getVisibleNodeEntries,
  getFolderNodeIds,
} from "../../src/features/tree/state/structure.js";
import { createStandardTree, createFolder, createBookmark } from "../fixtures/tree-data.js";

describe("isFolderNode", () => {
  test("returns true for type 0", () => {
    ok(isFolderNode(createFolder({ id: "f-1" })));
  });

  test("returns false for type 1", () => {
    notOk(isFolderNode(createBookmark({ id: "bm-1" })));
  });
});

describe("getNodeById", () => {
  test("finds node at root level", () => {
    const tree = createStandardTree();
    const node = getNodeById(tree, "f-work");
    ok(node !== null);
    strictEqual(node.folder.name, "Work");
  });

  test("finds node in nested folder", () => {
    const tree = createStandardTree();
    const node = getNodeById(tree, "bm-github");
    ok(node !== null);
    strictEqual(node.bookmark.title, "GitHub");
  });

  test("returns null for missing ID", () => {
    const tree = createStandardTree();
    strictEqual(getNodeById(tree, "nonexistent"), null);
  });

  test("returns null for empty tree", () => {
    strictEqual(getNodeById([], "anything"), null);
  });
});

describe("getParentNodeById", () => {
  test("finds parent at root level", () => {
    const tree = createStandardTree();
    const parent = getParentNodeById(tree, "bm-github");
    ok(parent !== null);
    strictEqual(parent.folder.name, "Work");
  });

  test("finds parent in nested folders", () => {
    const tree = [
      createFolder(
        { id: "f-root", name: "Root" },
        [
          createFolder(
            { id: "f-child", name: "Child" },
            [createBookmark({ id: "bm-deep" })],
          ),
        ],
      ),
    ];
    const parent = getParentNodeById(tree, "bm-deep");
    ok(parent !== null);
    strictEqual(parent.folder.name, "Child");
  });

  test("returns null for root nodes", () => {
    const tree = createStandardTree();
    strictEqual(getParentNodeById(tree, "f-work"), null);
  });

  test("returns null for missing ID", () => {
    const tree = createStandardTree();
    strictEqual(getParentNodeById(tree, "nonexistent"), null);
  });
});

describe("getParentIdById", () => {
  test("returns parent ID for child node", () => {
    const tree = createStandardTree();
    strictEqual(getParentIdById(tree, "bm-github"), "f-work");
  });

  test("returns empty string for root nodes", () => {
    const tree = createStandardTree();
    strictEqual(getParentIdById(tree, "f-work"), "");
  });

  test("returns empty string for missing ID", () => {
    const tree = createStandardTree();
    strictEqual(getParentIdById(tree, "nonexistent"), "");
  });
});

describe("getChildIndexById", () => {
  test("returns correct index", () => {
    const tree = createStandardTree();
    equal(getChildIndexById(tree, "f-work", "bm-github"), 0);
    equal(getChildIndexById(tree, "f-work", "bm-google"), 1);
  });

  test("returns -1 for invalid parent", () => {
    const tree = createStandardTree();
    equal(getChildIndexById(tree, "bm-github", "bm-google"), -1);
  });

  test("returns -1 for missing parent", () => {
    const tree = createStandardTree();
    equal(getChildIndexById(tree, "nonexistent", "bm-github"), -1);
  });

  test("returns -1 for missing child", () => {
    const tree = createStandardTree();
    equal(getChildIndexById(tree, "f-work", "nonexistent"), -1);
  });
});

describe("getAncestorIds", () => {
  test("returns chain from leaf to root", () => {
    const tree = [
      createFolder(
        { id: "f-root", name: "Root" },
        [
          createFolder(
            { id: "f-mid", name: "Mid" },
            [createBookmark({ id: "bm-leaf" })],
          ),
        ],
      ),
    ];
    const ancestors = getAncestorIds(tree, "bm-leaf");
    deepEqual(ancestors, ["f-mid", "f-root"]);
  });

  test("returns empty array for root nodes", () => {
    const tree = createStandardTree();
    deepEqual(getAncestorIds(tree, "f-work"), []);
  });

  test("returns empty array for missing ID", () => {
    const tree = createStandardTree();
    deepEqual(getAncestorIds(tree, "nonexistent"), []);
  });
});

describe("getSiblingIds", () => {
  test("returns siblings at same level", () => {
    const tree = createStandardTree();
    const siblings = getSiblingIds(tree, "bm-github");
    deepEqual(siblings, ["bm-github", "bm-google"]);
  });

  test("returns root-level siblings for root nodes", () => {
    const tree = createStandardTree();
    const siblings = getSiblingIds(tree, "f-work");
    deepEqual(siblings, ["f-work", "f-personal"]);
  });

  test("returns root siblings for missing ID", () => {
    const tree = createStandardTree();
    const siblings = getSiblingIds(tree, "nonexistent");
    // Missing nodes are treated as root-level, so returns root siblings
    deepEqual(siblings, ["f-work", "f-personal"]);
  });

  test("returns empty array for empty ID", () => {
    const tree = createStandardTree();
    deepEqual(getSiblingIds(tree, ""), []);
  });
});

describe("getVisibleNodeEntries", () => {
  test("shows root nodes when nothing expanded", () => {
    const tree = createStandardTree();
    const entries = getVisibleNodeEntries(tree, []);
    equal(entries.length, 2);
    strictEqual(entries[0].id, "f-work");
    strictEqual(entries[1].id, "f-personal");
  });

  test("shows children when parent expanded", () => {
    const tree = createStandardTree();
    const entries = getVisibleNodeEntries(tree, ["f-work"]);
    // f-work + children (bm-github, bm-google) + f-personal (root, not expanded)
    equal(entries.length, 4);
    strictEqual(entries[0].id, "f-work");
    strictEqual(entries[1].id, "bm-github");
    strictEqual(entries[2].id, "bm-google");
    strictEqual(entries[3].id, "f-personal");
  });

  test("respects depth values", () => {
    const tree = createStandardTree();
    const entries = getVisibleNodeEntries(tree, ["f-work"]);
    equal(entries[0].depth, 0);
    equal(entries[1].depth, 1);
    equal(entries[2].depth, 1);
  });

  test("respects parentId values", () => {
    const tree = createStandardTree();
    const entries = getVisibleNodeEntries(tree, ["f-work"]);
    strictEqual(entries[0].parentId, "");
    strictEqual(entries[1].parentId, "f-work");
    strictEqual(entries[2].parentId, "f-work");
  });

  test("hides collapsed children", () => {
    const tree = createStandardTree();
    const entries = getVisibleNodeEntries(tree, []);
    const ids = entries.map((e) => e.id);
    ok(!ids.includes("bm-github"));
    ok(!ids.includes("bm-google"));
    ok(!ids.includes("bm-reddit"));
  });

  test("handles nested expansion", () => {
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
    const entries = getVisibleNodeEntries(tree, ["f-root", "f-child"]);
    equal(entries.length, 3);
    strictEqual(entries[0].id, "f-root");
    strictEqual(entries[1].id, "f-child");
    strictEqual(entries[2].id, "bm-deep");
  });
});

describe("getFolderNodeIds", () => {
  test("returns all folder IDs recursively", () => {
    const tree = [
      createFolder(
        { id: "f-root" },
        [
          createFolder(
            { id: "f-child" },
            [createBookmark({ id: "bm-1" })],
          ),
        ],
      ),
      createFolder({ id: "f-sibling" }),
    ];
    const ids = getFolderNodeIds(tree);
    deepEqual(ids.sort(), ["f-child", "f-root", "f-sibling"].sort());
  });

  test("returns empty array for bookmarks only", () => {
    const tree = [createBookmark({ id: "bm-1" })];
    deepEqual(getFolderNodeIds(tree), []);
  });

  test("returns empty array for empty tree", () => {
    deepEqual(getFolderNodeIds([]), []);
  });
});
