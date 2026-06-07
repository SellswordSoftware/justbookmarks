// @ts-check

import { describe, test } from "../lib/test.js";
import { strictEqual, ok, deepEqual } from "../lib/assert.js";
import { moveDialogState } from "../../src/features/move/move-dialog-state.js";

/**
 * Create a folder node for testing.
 * @param {string} id
 * @param {string} name
 * @param {TreeNode[]} [children]
 * @returns {FolderNode}
 */
function folder(id, name, children = []) {
  return {
    type: 0,
    id,
    folder: {
      id,
      name,
      icon: "",
      addDate: "",
      lastModified: "",
      meta: "",
      childCount: children.length,
      children,
      childrenLoaded: true,
    },
  };
}

/**
 * Create a bookmark node for testing.
 * @param {string} id
 * @param {string} title
 * @returns {BookmarkNode}
 */
function bookmark(id, title) {
  return {
    type: 1,
    id,
    bookmark: {
      id,
      title,
      url: "",
      icon: "",
      iconURI: "",
      addDate: "",
      lastModified: "",
      meta: "",
    },
  };
}

describe("moveDialogState: open/close", () => {
  test("openDialog opens the dialog and resets state", () => {
    moveDialogState.actions.closeMoveDialog();
    moveDialogState.actions.openDialog({
      nodeIds: ["1"],
      label: "Test",
      type: "bookmark",
    });
    ok(moveDialogState.selectors.isOpen());
    strictEqual(moveDialogState.selectors.getRequest()?.nodeIds[0], "1");
    strictEqual(moveDialogState.selectors.getSelectedTarget(), "");
    strictEqual(moveDialogState.selectors.getFilterQuery(), "");
  });

  test("closeMoveDialog closes the dialog and clears state", () => {
    moveDialogState.actions.openDialog({
      nodeIds: ["1"],
      label: "Test",
      type: "bookmark",
    });
    moveDialogState.actions.closeMoveDialog();
    ok(!moveDialogState.selectors.isOpen());
    strictEqual(moveDialogState.selectors.getRequest(), null);
    strictEqual(moveDialogState.selectors.getSelectedTarget(), "");
  });
});

describe("moveDialogState: requests", () => {
  test("showMoveDialog creates a single-node move request", () => {
    moveDialogState.actions.closeMoveDialog();
    moveDialogState.actions.showMoveDialog("1", "Test Bookmark", "bookmark");
    const request = moveDialogState.selectors.getRequest();
    ok(request);
    strictEqual(request.nodeIds.length, 1);
    strictEqual(request.type, "bookmark");
    strictEqual(request.label, "Test Bookmark");
  });

  test("showBulkMoveDialog creates a multi-node move request", () => {
    moveDialogState.actions.closeMoveDialog();
    moveDialogState.actions.showBulkMoveDialog(["1", "2", "3"], "bookmark");
    const request = moveDialogState.selectors.getRequest();
    ok(request);
    strictEqual(request.nodeIds.length, 3);
    strictEqual(request.label, "3 bookmarks");
  });

  test("showBulkMoveDialog singular label for single item", () => {
    moveDialogState.actions.closeMoveDialog();
    moveDialogState.actions.showBulkMoveDialog(["1"], "folder");
    const request = moveDialogState.selectors.getRequest();
    ok(request);
    strictEqual(request.label, "1 folder");
  });
});

describe("moveDialogState: selection and expansion", () => {
  test("setSelectedTarget updates the selected target", () => {
    strictEqual(moveDialogState.selectors.getSelectedTarget(), "");
    moveDialogState.actions.setSelectedTarget("folder-1");
    strictEqual(moveDialogState.selectors.getSelectedTarget(), "folder-1");
  });

  test("setFilterQuery updates the filter query", () => {
    moveDialogState.actions.setFilterQuery("test");
    strictEqual(moveDialogState.selectors.getFilterQuery(), "test");
  });

  test("toggleExpanded toggles folder expansion", () => {
    moveDialogState.actions.setTreeNodes([folder("f1", "Folder 1")]);
    moveDialogState.actions.openDialog({
      nodeIds: ["1"],
      label: "Test",
      type: "bookmark",
    });
    ok(!moveDialogState.selectors.isExpanded("f1"));
    moveDialogState.actions.toggleExpanded("f1");
    ok(moveDialogState.selectors.isExpanded("f1"));
    moveDialogState.actions.toggleExpanded("f1");
    ok(!moveDialogState.selectors.isExpanded("f1"));
  });

  test("isFolderLoading tracks loading state", () => {
    moveDialogState.actions.setFolderLoading("f1", true);
    ok(moveDialogState.selectors.isFolderLoading("f1"));
    moveDialogState.actions.setFolderLoading("f1", false);
    ok(!moveDialogState.selectors.isFolderLoading("f1"));
  });

  test("setFolderLoading adds and removes from loading set independently", () => {
    moveDialogState.actions.setFolderLoading("f1", false);
    moveDialogState.actions.setFolderLoading("f2", false);
    moveDialogState.actions.setFolderLoading("f1", true);
    moveDialogState.actions.setFolderLoading("f2", true);
    ok(moveDialogState.selectors.isFolderLoading("f1"));
    ok(moveDialogState.selectors.isFolderLoading("f2"));
    moveDialogState.actions.setFolderLoading("f1", false);
    ok(!moveDialogState.selectors.isFolderLoading("f1"));
    ok(moveDialogState.selectors.isFolderLoading("f2"));
  });
});

describe("moveDialogState: visible folders", () => {
  test("getVisibleFolders returns empty when no request", () => {
    moveDialogState.actions.closeMoveDialog();
    deepEqual(moveDialogState.selectors.getVisibleFolders(), []);
  });

  test("getVisibleFolders returns folders when request is set", () => {
    const nodes = [
      folder("f1", "Folder 1", [bookmark("b1", "Bookmark 1")]),
      folder("f2", "Folder 2"),
    ];
    moveDialogState.actions.openDialog(
      { nodeIds: ["b1"], label: "Bookmark 1", type: "bookmark" },
      nodes,
    );
    const folders = moveDialogState.selectors.getVisibleFolders();
    strictEqual(folders.length, 2);
  });

  test("getVisibleFolders excludes folder nodes when moving a folder", () => {
    const nodes = [
      folder("f1", "Folder 1"),
      folder("f2", "Folder 2"),
    ];
    moveDialogState.actions.openDialog(
      { nodeIds: ["f1"], label: "Folder 1", type: "folder" },
      nodes,
    );
    const folders = moveDialogState.selectors.getVisibleFolders();
    strictEqual(folders.length, 1);
    strictEqual(folders[0].id, "f2");
  });

  test("getVisibleFolders respects filter query", () => {
    const nodes = [
      folder("f1", "Alpha"),
      folder("f2", "Beta"),
    ];
    moveDialogState.actions.openDialog(
      { nodeIds: ["1"], label: "Test", type: "bookmark" },
      nodes,
    );
    moveDialogState.actions.setFilterQuery("alpha");
    const folders = moveDialogState.selectors.getVisibleFolders();
    strictEqual(folders.length, 1);
    strictEqual(folders[0].id, "f1");
  });

  test("getVisibleFolders respects expansion state", () => {
    const nodes = [
      folder("f1", "Parent", [
        folder("f2", "Child"),
      ]),
    ];
    moveDialogState.actions.openDialog(
      { nodeIds: ["1"], label: "Test", type: "bookmark" },
      nodes,
    );
    // Without expansion, only root folders visible
    const collapsed = moveDialogState.selectors.getVisibleFolders();
    strictEqual(collapsed.length, 1);
    strictEqual(collapsed[0].id, "f1");

    // With expansion, child folders also visible
    moveDialogState.actions.toggleExpanded("f1");
    const expanded = moveDialogState.selectors.getVisibleFolders();
    strictEqual(expanded.length, 2);
  });

  test("getVisibleFolders shows depth values", () => {
    const nodes = [
      folder("f1", "Root", [
        folder("f2", "Child", [
          folder("f3", "Grandchild"),
        ]),
      ]),
    ];
    moveDialogState.actions.openDialog(
      { nodeIds: ["1"], label: "Test", type: "bookmark" },
      nodes,
    );
    moveDialogState.actions.toggleExpanded("f1");
    moveDialogState.actions.toggleExpanded("f2");
    const folders = moveDialogState.selectors.getVisibleFolders();
    strictEqual(folders[0].depth, 0);
    strictEqual(folders[1].depth, 1);
    strictEqual(folders[2].depth, 2);
  });

  test("getVisibleFolders includes hasChildren", () => {
    const nodes = [
      folder("f1", "WithChild", [folder("f2", "Child")]),
      folder("f3", "Empty"),
    ];
    moveDialogState.actions.openDialog(
      { nodeIds: ["1"], label: "Test", type: "bookmark" },
      nodes,
    );
    moveDialogState.actions.toggleExpanded("f1");
    const folders = moveDialogState.selectors.getVisibleFolders();
    const withChild = folders.find((f) => f.id === "f1");
    const empty = folders.find((f) => f.id === "f3");
    ok(withChild?.hasChildren);
    ok(!empty?.hasChildren);
  });
});

describe("moveDialogState: openDialog resets state", () => {
  test("openDialog clears expanded state on open", () => {
    moveDialogState.actions.setTreeNodes([folder("f1", "Folder")]);
    moveDialogState.actions.openDialog({
      nodeIds: ["1"], label: "A", type: "bookmark",
    });
    moveDialogState.actions.toggleExpanded("f1");
    ok(moveDialogState.selectors.isExpanded("f1"));

    // Re-open should reset
    moveDialogState.actions.openDialog({
      nodeIds: ["2"], label: "B", type: "bookmark",
    });
    ok(!moveDialogState.selectors.isExpanded("f1"));
  });

  test("openDialog clears loading state on open", () => {
    moveDialogState.actions.setFolderLoading("f1", true);
    ok(moveDialogState.selectors.isFolderLoading("f1"));

    moveDialogState.actions.openDialog({
      nodeIds: ["1"], label: "A", type: "bookmark",
    });
    ok(!moveDialogState.selectors.isFolderLoading("f1"));
  });
});
