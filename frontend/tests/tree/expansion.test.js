// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual, notOk } from "../lib/assert.js";
import {
  toggleExpandedId,
  isExpandedId,
  expandAncestorIds,
  getDefaultExpandedFolderIds,
} from "../../src/features/tree/state/expansion.js";
import { createStandardTree, createFolder, createBookmark } from "../fixtures/tree-data.js";

describe("toggleExpandedId", () => {
  test("adds ID if not present", () => {
    const result = toggleExpandedId(["a", "b"], "c");
    deepEqual(result, ["a", "b", "c"]);
  });

  test("removes ID if present", () => {
    const result = toggleExpandedId(["a", "b", "c"], "b");
    deepEqual(result, ["a", "c"]);
  });

  test("returns new array (no mutation)", () => {
    const original = ["a", "b"];
    toggleExpandedId(original, "c");
    deepEqual(original, ["a", "b"]);
  });

  test("handles empty input", () => {
    const result = toggleExpandedId([], "a");
    deepEqual(result, ["a"]);
  });

  test("removes from empty result", () => {
    const result = toggleExpandedId(["a"], "a");
    deepEqual(result, []);
  });
});

describe("isExpandedId", () => {
  test("returns true for expanded ID", () => {
    ok(isExpandedId(["a", "b"], "a"));
    ok(isExpandedId(["a", "b"], "b"));
  });

  test("returns false for non-expanded ID", () => {
    notOk(isExpandedId(["a", "b"], "c"));
  });

  test("returns false for empty set", () => {
    notOk(isExpandedId([], "a"));
  });

  test("works with Set input", () => {
    ok(isExpandedId(new Set(["a", "b"]), "a"));
    notOk(isExpandedId(new Set(["a", "b"]), "c"));
  });
});

describe("expandAncestorIds", () => {
  test("adds missing ancestors", () => {
    const result = expandAncestorIds(["a"], ["b", "c"]);
    deepEqual(result, ["a", "b", "c"]);
  });

  test("skips already-expanded ancestors", () => {
    const result = expandAncestorIds(["a", "b"], ["b", "c"]);
    deepEqual(result, ["a", "b", "c"]);
  });

  test("returns same array when all present", () => {
    const result = expandAncestorIds(["a", "b"], ["a", "b"]);
    deepEqual(result, ["a", "b"]);
  });

  test("handles empty expanded list", () => {
    const result = expandAncestorIds([], ["a", "b"]);
    deepEqual(result, ["a", "b"]);
  });

  test("handles empty ancestors", () => {
    const result = expandAncestorIds(["a", "b"], []);
    deepEqual(result, ["a", "b"]);
  });

  test("returns new array (no mutation)", () => {
    const original = ["a"];
    expandAncestorIds(original, ["b"]);
    deepEqual(original, ["a"]);
  });
});

describe("getDefaultExpandedFolderIds", () => {
  test("returns root-level folder IDs", () => {
    const tree = createStandardTree();
    const ids = getDefaultExpandedFolderIds(tree);
    deepEqual(ids.sort(), ["f-personal", "f-work"].sort());
  });

  test("excludes bookmarks", () => {
    const tree = [
      createFolder({ id: "f-1" }),
      createBookmark({ id: "bm-1" }),
    ];
    const ids = getDefaultExpandedFolderIds(tree);
    deepEqual(ids, ["f-1"]);
  });

  test("returns empty array for empty tree", () => {
    const ids = getDefaultExpandedFolderIds([]);
    deepEqual(ids, []);
  });

  test("excludes nested folder IDs", () => {
    const tree = [
      createFolder(
        { id: "f-root" },
        [createFolder({ id: "f-child" })],
      ),
    ];
    const ids = getDefaultExpandedFolderIds(tree);
    deepEqual(ids, ["f-root"]);
  });
});
