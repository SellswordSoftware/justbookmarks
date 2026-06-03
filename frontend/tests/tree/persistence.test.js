// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual } from "../lib/assert.js";
import {
  pruneSelectionState,
  restorePersistentTreeState,
  getPersistentTreeState,
} from "../../src/features/tree/state/persistence.js";
import { createStandardTree, createFolder, createBookmark, createSelectionState } from "../fixtures/tree-data.js";

describe("pruneSelectionState", () => {
  test("keeps valid IDs", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github", "bm-google"]);
    const result = pruneSelectionState(tree, state);
    deepEqual(result.selectedNodeIds, ["bm-github", "bm-google"]);
    strictEqual(result.primarySelectedNodeId, "bm-github");
  });

  test("removes invalid IDs", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github", "nonexistent"]);
    const result = pruneSelectionState(tree, state);
    deepEqual(result.selectedNodeIds, ["bm-github"]);
  });

  test("clears selection when all IDs invalid", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["nonexistent-1", "nonexistent-2"]);
    const result = pruneSelectionState(tree, state);
    deepEqual(result.selectedNodeIds, []);
    strictEqual(result.primarySelectedNodeId, "");
  });

  test("updates primary when it becomes invalid", () => {
    const tree = createStandardTree();
    const state = {
      selectedNodeIds: ["bm-github", "bm-google"],
      primarySelectedNodeId: "nonexistent",
      selectionAnchorNodeId: "bm-github",
    };
    const result = pruneSelectionState(tree, state);
    strictEqual(result.primarySelectedNodeId, "bm-github");
  });

  test("handles empty selection", () => {
    const tree = createStandardTree();
    const state = createEmptySelectionState();
    const result = pruneSelectionState(tree, state);
    deepEqual(result.selectedNodeIds, []);
    strictEqual(result.primarySelectedNodeId, "");
  });

  test("updates anchor when it becomes invalid", () => {
    const tree = createStandardTree();
    const state = {
      selectedNodeIds: ["bm-github"],
      primarySelectedNodeId: "bm-github",
      selectionAnchorNodeId: "nonexistent",
    };
    const result = pruneSelectionState(tree, state);
    strictEqual(result.selectionAnchorNodeId, "bm-github");
  });
});

describe("restorePersistentTreeState", () => {
  test("restores from valid state", () => {
    const tree = createStandardTree();
    const state = {
      expandedNodeIds: ["f-work"],
      selectedNodeId: "bm-github",
      scrollTop: 100,
    };
    const result = restorePersistentTreeState(tree, state);
    deepEqual(result.expandedNodeIds, ["f-work"]);
    strictEqual(result.selectionState.primarySelectedNodeId, "bm-github");
    equal(result.scrollTop, 100);
  });

  test("returns defaults for null state", () => {
    const tree = createStandardTree();
    const result = restorePersistentTreeState(tree, null);
    deepEqual(result.expandedNodeIds, []);
    deepEqual(result.selectionState.selectedNodeIds, []);
    equal(result.scrollTop, 0);
  });

  test("returns defaults for undefined state", () => {
    const tree = createStandardTree();
    const result = restorePersistentTreeState(tree, undefined);
    deepEqual(result.expandedNodeIds, []);
    equal(result.scrollTop, 0);
  });

  test("filters non-string expanded IDs", () => {
    const tree = createStandardTree();
    const state = {
      expandedNodeIds: ["f-work", 123, null, "f-personal"],
      selectedNodeId: "",
      scrollTop: 0,
    };
    const result = restorePersistentTreeState(tree, state);
    deepEqual(result.expandedNodeIds, ["f-work", "f-personal"]);
  });

  test("handles invalid scrollTop", () => {
    const tree = createStandardTree();
    const state = {
      expandedNodeIds: [],
      selectedNodeId: "",
      scrollTop: "not-a-number",
    };
    const result = restorePersistentTreeState(tree, state);
    equal(result.scrollTop, 0);
  });

  test("handles NaN scrollTop", () => {
    const tree = createStandardTree();
    const state = {
      expandedNodeIds: [],
      selectedNodeId: "",
      scrollTop: NaN,
    };
    const result = restorePersistentTreeState(tree, state);
    equal(result.scrollTop, 0);
  });
});

describe("getPersistentTreeState", () => {
  test("returns correct PerFileTreeState", () => {
    const result = getPersistentTreeState(["f-work", "f-personal"], "bm-github", 100);
    deepEqual(result.expandedNodeIds, ["f-work", "f-personal"]);
    strictEqual(result.selectedNodeId, "bm-github");
    equal(result.scrollTop, 100);
  });

  test("copies expandedNodeIds array", () => {
    const expanded = ["f-work"];
    const result = getPersistentTreeState(expanded, "bm-github", 0);
    ok(result.expandedNodeIds !== expanded);
    deepEqual(result.expandedNodeIds, ["f-work"]);
  });
});

/** @returns {{ selectedNodeIds: string[], primarySelectedNodeId: string, selectionAnchorNodeId: string }} */
function createEmptySelectionState() {
  return {
    selectedNodeIds: [],
    primarySelectedNodeId: "",
    selectionAnchorNodeId: "",
  };
}
