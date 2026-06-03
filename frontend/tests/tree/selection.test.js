// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual, notOk } from "../lib/assert.js";
import {
  createSingleSelectionState,
  createEmptySelectionState,
  canJoinSelection,
  toggleSelected,
  selectRange,
  extendSelectionByOffset,
  selectAllSiblings,
  captureSelectionSnapshot,
  restoreSelectionSnapshot,
} from "../../src/features/tree/state/selection.js";
import { createStandardTree, createFolder, createBookmark, createSelectionState } from "../fixtures/tree-data.js";

describe("createSingleSelectionState", () => {
  test("creates correct state object", () => {
    const state = createSingleSelectionState("bm-1");
    deepEqual(state.selectedNodeIds, ["bm-1"]);
    strictEqual(state.primarySelectedNodeId, "bm-1");
    strictEqual(state.selectionAnchorNodeId, "bm-1");
  });
});

describe("createEmptySelectionState", () => {
  test("creates empty state", () => {
    const state = createEmptySelectionState();
    deepEqual(state.selectedNodeIds, []);
    strictEqual(state.primarySelectedNodeId, "");
    strictEqual(state.selectionAnchorNodeId, "");
  });
});

describe("canJoinSelection", () => {
  test("returns true for same parent and type", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    ok(canJoinSelection(tree, state, "bm-google"));
  });

  test("returns false for different parent", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    notOk(canJoinSelection(tree, state, "bm-reddit"));
  });

  test("returns false for different type", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    notOk(canJoinSelection(tree, state, "f-work"));
  });

  test("returns false for empty candidate", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    notOk(canJoinSelection(tree, state, ""));
  });

  test("returns false for missing candidate", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    notOk(canJoinSelection(tree, state, "nonexistent"));
  });

  test("returns true for empty selection with valid node", () => {
    const tree = createStandardTree();
    const state = createEmptySelectionState();
    ok(canJoinSelection(tree, state, "bm-github"));
  });
});

describe("toggleSelected", () => {
  test("adds to selection", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = toggleSelected(tree, state, "bm-google");
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github", "bm-google"]);
    strictEqual(result.nextState.primarySelectedNodeId, "bm-google");
  });

  test("removes from selection", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github", "bm-google"]);
    const result = toggleSelected(tree, state, "bm-github");
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-google"]);
    strictEqual(result.nextState.primarySelectedNodeId, "bm-google");
  });

  test("clears selection when last item removed", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = toggleSelected(tree, state, "bm-github");
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, []);
    strictEqual(result.nextState.primarySelectedNodeId, "");
  });

  test("rejects invalid join", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = toggleSelected(tree, state, "bm-reddit");
    notOk(result.changed);
    strictEqual(result.nextState, null);
  });

  test("rejects missing node", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = toggleSelected(tree, state, "nonexistent");
    notOk(result.changed);
    strictEqual(result.nextState, null);
  });

  test("creates single selection from empty state", () => {
    const tree = createStandardTree();
    const state = createEmptySelectionState();
    const result = toggleSelected(tree, state, "bm-github");
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github"]);
  });
});

describe("selectRange", () => {
  test("selects range between anchor and target", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const visibleIds = ["bm-github", "bm-google"];
    const result = selectRange(tree, state, "bm-google", visibleIds);
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github", "bm-google"]);
  });

  test("selects range in reverse order", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-google"]);
    const visibleIds = ["bm-github", "bm-google"];
    const result = selectRange(tree, state, "bm-github", visibleIds);
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github", "bm-google"]);
  });

  test("creates single selection when no anchor", () => {
    const tree = createStandardTree();
    const state = createEmptySelectionState();
    const result = selectRange(tree, state, "bm-github", ["bm-github", "bm-google"]);
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github"]);
  });

  test("rejects invalid join", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = selectRange(tree, state, "bm-reddit", ["bm-github", "bm-google", "bm-reddit"]);
    notOk(result.changed);
    strictEqual(result.nextState, null);
  });
});

describe("extendSelectionByOffset", () => {
  test("extends forward by one", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = extendSelectionByOffset(tree, state, 1);
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github", "bm-google"]);
  });

  test("extends backward by one", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-google"]);
    const result = extendSelectionByOffset(tree, state, -1);
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github", "bm-google"]);
  });

  test("no change for zero offset", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = extendSelectionByOffset(tree, state, 0);
    notOk(result.changed);
    strictEqual(result.nextState, null);
  });

  test("no change for empty selection", () => {
    const tree = createStandardTree();
    const state = createEmptySelectionState();
    const result = extendSelectionByOffset(tree, state, 1);
    notOk(result.changed);
    strictEqual(result.nextState, null);
  });

  test("no change when at boundary", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-google"]);
    const result = extendSelectionByOffset(tree, state, 1);
    notOk(result.changed);
  });
});

describe("selectAllSiblings", () => {
  test("selects all joinable siblings", () => {
    const tree = createStandardTree();
    const state = createSelectionState(["bm-github"]);
    const result = selectAllSiblings(tree, state);
    ok(result.changed);
    ok(result.nextState !== null);
    deepEqual(result.nextState.selectedNodeIds, ["bm-github", "bm-google"]);
  });

  test("no change for empty selection", () => {
    const tree = createStandardTree();
    const state = createEmptySelectionState();
    const result = selectAllSiblings(tree, state);
    notOk(result.changed);
    strictEqual(result.nextState, null);
  });
});

describe("captureSelectionSnapshot", () => {
  test("captures current state with ancestors", () => {
    const tree = createStandardTree();
    const snapshot = captureSelectionSnapshot(tree, ["bm-github"], "bm-github");
    strictEqual(snapshot.primaryNodeId, "bm-github");
    deepEqual(snapshot.selectedNodeIds, ["bm-github"]);
    deepEqual(snapshot.ancestorIds, ["f-work"]);
  });

  test("captures empty state", () => {
    const tree = createStandardTree();
    const snapshot = captureSelectionSnapshot(tree, [], "");
    strictEqual(snapshot.primaryNodeId, "");
    deepEqual(snapshot.selectedNodeIds, []);
    deepEqual(snapshot.ancestorIds, []);
  });
});

describe("restoreSelectionSnapshot", () => {
  test("restores valid snapshot", () => {
    const tree = createStandardTree();
    const snapshot = {
      selectedNodeIds: ["bm-github", "bm-google"],
      primaryNodeId: "bm-google",
      ancestorIds: ["f-work"],
    };
    const state = restoreSelectionSnapshot(tree, snapshot);
    deepEqual(state.selectedNodeIds, ["bm-github", "bm-google"]);
    strictEqual(state.primarySelectedNodeId, "bm-google");
  });

  test("restores single selection when multi invalid", () => {
    const tree = createStandardTree();
    const snapshot = {
      selectedNodeIds: ["bm-github", "bm-reddit"],
      primaryNodeId: "bm-github",
      ancestorIds: ["f-work"],
    };
    const state = restoreSelectionSnapshot(tree, snapshot);
    deepEqual(state.selectedNodeIds, ["bm-github"]);
  });

  test("restores primary from snapshot", () => {
    const tree = createStandardTree();
    const snapshot = {
      selectedNodeIds: ["nonexistent"],
      primaryNodeId: "bm-github",
      ancestorIds: [],
    };
    const state = restoreSelectionSnapshot(tree, snapshot);
    strictEqual(state.primarySelectedNodeId, "bm-github");
  });

  test("falls back to ancestor", () => {
    const tree = createStandardTree();
    const snapshot = {
      selectedNodeIds: ["nonexistent"],
      primaryNodeId: "also-missing",
      ancestorIds: ["f-work"],
    };
    const state = restoreSelectionSnapshot(tree, snapshot);
    strictEqual(state.primarySelectedNodeId, "f-work");
  });

  test("returns empty state for null snapshot", () => {
    const tree = createStandardTree();
    const state = restoreSelectionSnapshot(tree, null);
    deepEqual(state.selectedNodeIds, []);
    strictEqual(state.primarySelectedNodeId, "");
  });

  test("returns empty state for missing snapshot", () => {
    const tree = createStandardTree();
    const state = restoreSelectionSnapshot(tree, undefined);
    deepEqual(state.selectedNodeIds, []);
    strictEqual(state.primarySelectedNodeId, "");
  });
});
