// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual } from "../lib/assert.js";

/**
 * Test shared/infra/persistence.js.
 *
 * This module accesses window.localStorage, so we stub it here.
 * The run.js DOM mock already sets window.localStorage = null,
 * so we need to override it per-test.
 */

// Re-export the sanitizeState logic by importing the actual module.
// We can't import it at the top level because it calls loadPersistedUIState()
// which accesses localStorage immediately. Instead, we import lazily.

/** @type {() => Promise<typeof import("../../src/shared/infra/persistence.js")>} */
const loadPersistence = async () => {
  return import("../../src/shared/infra/persistence.js");
};

describe("persistence with localStorage stub", () => {
  /** @type {Map<string, string>} */
  const storageMap = new Map();

  /** @type {Storage} */
  const fakeLocalStorage = {
    getItem(key) {
      return storageMap.get(key) ?? null;
    },
    setItem(key, value) {
      storageMap.set(key, value);
    },
    removeItem(key) {
      storageMap.delete(key);
    },
    clear() {
      storageMap.clear();
    },
    get length() {
      return storageMap.size;
    },
    key(index) {
      return [...storageMap.keys()][index] ?? null;
    },
  };

  test.beforeEach(() => {
    storageMap.clear();
    globalThis.window.localStorage = fakeLocalStorage;
  });

  test.afterEach(() => {
    globalThis.window.localStorage = null;
  });

  test("loadPersistedUIState returns defaults when empty", async () => {
    const { loadPersistedUIState } = await loadPersistence();
    const state = loadPersistedUIState();
    strictEqual(state.lastOpenedFile, "");
    strictEqual(state.theme, "dark");
    equal(state.leftPaneWidth, 360);
    strictEqual(state.window, null);
    deepEqual(state.files, {});
  });

  test("loadPersistedUIState reads from localStorage", async () => {
    const { loadPersistedUIState, savePersistedUIState } = await loadPersistence();

    const customState = {
      lastOpenedFile: "/home/user/bookmarks.html",
      leftPaneWidth: 400,
      window: { width: 1200, height: 800 },
      files: {
        "/home/user/bookmarks.html": {
          expandedNodeIds: ["f-1"],
          selectedNodeId: "bm-1",
          scrollTop: 100,
        },
      },
      theme: "light",
    };
    savePersistedUIState(customState);

    const state = loadPersistedUIState();
    strictEqual(state.lastOpenedFile, "/home/user/bookmarks.html");
    equal(state.leftPaneWidth, 400);
    strictEqual(state.theme, "light");
    ok(state.window !== null);
    equal(state.window.width, 1200);
    equal(state.window.height, 800);
    ok(Object.hasOwn(state.files, "/home/user/bookmarks.html"));
  });

  test("loadPersistedUIState sanitizes malformed data", async () => {
    fakeLocalStorage.setItem("justbookmarks.ui-state.v1", JSON.stringify({
      lastOpenedFile: 123,
      leftPaneWidth: "not-a-number",
      window: { width: "wide", height: null },
      theme: "invalid-theme",
      files: {
        "/path": {
          expandedNodeIds: ["valid", 123, null],
          selectedNodeId: 456,
          scrollTop: "not-a-number",
        },
      },
    }));

    const { loadPersistedUIState } = await loadPersistence();
    const state = loadPersistedUIState();

    strictEqual(state.lastOpenedFile, "");
    equal(state.leftPaneWidth, 360);
    strictEqual(state.window, null);
    strictEqual(state.theme, "dark");

    const fileState = state.files["/path"];
    ok(fileState !== undefined);
    deepEqual(fileState.expandedNodeIds, ["valid"]);
    strictEqual(fileState.selectedNodeId, "");
    equal(fileState.scrollTop, 0);
  });

  test("loadPersistedUIState handles corrupted JSON", async () => {
    fakeLocalStorage.setItem("justbookmarks.ui-state.v1", "{invalid json");

    const { loadPersistedUIState } = await loadPersistence();
    const state = loadPersistedUIState();
    strictEqual(state.lastOpenedFile, "");
    strictEqual(state.theme, "dark");
  });

  test("loadPersistedUIState handles null localStorage value", async () => {
    const { loadPersistedUIState } = await loadPersistence();
    const state = loadPersistedUIState();
    strictEqual(state.lastOpenedFile, "");
  });

  test("setLastOpenedFile updates state", async () => {
    const { setLastOpenedFile } = await loadPersistence();
    const state = setLastOpenedFile("/new/path.html");
    strictEqual(state.lastOpenedFile, "/new/path.html");
  });

  test("clearLastOpenedFile clears path", async () => {
    const { clearLastOpenedFile } = await loadPersistence();
    const state = clearLastOpenedFile();
    strictEqual(state.lastOpenedFile, "");
  });

  test("setLeftPaneWidth updates width", async () => {
    const { setLeftPaneWidth } = await loadPersistence();
    const state = setLeftPaneWidth(500);
    equal(state.leftPaneWidth, 500);
  });

  test("setWindowState updates window state", async () => {
    const { setWindowState } = await loadPersistence();
    const state = setWindowState({ width: 1400, height: 900 });
    ok(state.window !== null);
    equal(state.window.width, 1400);
    equal(state.window.height, 900);
  });

  test("setWindowState handles null input", async () => {
    const { setWindowState } = await loadPersistence();
    const state = setWindowState(null);
    strictEqual(state.window, null);
  });

  test("setTheme updates theme", async () => {
    const { setTheme } = await loadPersistence();
    const state = setTheme("light");
    strictEqual(state.theme, "light");
  });

  test("setPerFileTreeState saves file state", async () => {
    const { setPerFileTreeState } = await loadPersistence();
    const state = setPerFileTreeState("/test.html", {
      expandedNodeIds: ["f-1", "f-2"],
      selectedNodeId: "bm-1",
      scrollTop: 50,
    });

    ok(Object.hasOwn(state.files, "/test.html"));
    deepEqual(state.files["/test.html"].expandedNodeIds, ["f-1", "f-2"]);
    strictEqual(state.files["/test.html"].selectedNodeId, "bm-1");
    equal(state.files["/test.html"].scrollTop, 50);
  });

  test("setPerFileTreeState evicts old entries beyond limit", async () => {
    const { setPerFileTreeState } = await loadPersistence();

    // Add 11 entries (limit is 10)
    for (let i = 0; i < 11; i++) {
      setPerFileTreeState(`/file-${i}.html`, {
        expandedNodeIds: [],
        selectedNodeId: "",
        scrollTop: 0,
      });
    }

    const state = setPerFileTreeState("/file-11.html", {
      expandedNodeIds: [],
      selectedNodeId: "",
      scrollTop: 0,
    });

    // Should have exactly 10 entries (first one evicted)
    equal(Object.keys(state.files).length, 10);
    ok(!Object.hasOwn(state.files, "/file-0.html"));
    ok(Object.hasOwn(state.files, "/file-11.html"));
  });
});

describe("persistence without localStorage", () => {
  test("returns defaults when localStorage is unavailable", async () => {
    globalThis.window.localStorage = null;

    const { loadPersistedUIState } = await loadPersistence();
    const state = loadPersistedUIState();
    strictEqual(state.lastOpenedFile, "");
    strictEqual(state.theme, "dark");
    equal(state.leftPaneWidth, 360);
  });

  test("savePersistedUIState is no-op when localStorage unavailable", async () => {
    globalThis.window.localStorage = null;

    const { savePersistedUIState } = await loadPersistence();
    // Should not throw
    savePersistedUIState({
      lastOpenedFile: "/test.html",
      leftPaneWidth: 360,
      window: null,
      files: {},
      theme: "dark",
    });
  });
});
