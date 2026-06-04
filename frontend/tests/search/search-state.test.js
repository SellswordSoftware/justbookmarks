// @ts-check

import { describe, test } from "../lib/test.js";
import { strictEqual, ok, deepEqual } from "../lib/assert.js";
import { searchState, setSearchStateTimerFactory } from "../../src/features/search/state/search-state.js";

/**
 * Fake timer that runs callbacks immediately (no delay).
 *
 * @param {() => void} fn
 * @param {number} _delay
 * @returns {number}
 */
function instantTimer(fn, _delay) {
  fn();
  return /** @type {number} */ (0);
}

/**
 * No-op cancel (callbacks already ran).
 * @param {number} _id
 */
function noopCancel(_id) {}

/**
 * Install instant timers so debounced updates fire synchronously.
 */
function installInstantTimers() {
  setSearchStateTimerFactory(instantTimer, noopCancel);
}

/**
 * Restore real timers.
 */
function restoreRealTimers() {
  setSearchStateTimerFactory(setTimeout, clearTimeout);
}

describe("searchState: query", () => {
  test("setQuery updates the query signal", () => {
    searchState.actions.setQuery("hello");
    strictEqual(searchState.selectors.getQuery(), "hello");
  });

  test("clearQuery resets query to empty string", () => {
    searchState.actions.setQuery("hello");
    searchState.actions.clearQuery();
    strictEqual(searchState.selectors.getQuery(), "");
  });

  test("isSearching returns false when query is empty", () => {
    searchState.actions.clearQuery();
    ok(!searchState.selectors.isSearching());
  });

  test("isSearching returns true when query has content", () => {
    searchState.actions.setQuery("test");
    ok(searchState.selectors.isSearching());
  });

  test("isSearching returns false for whitespace-only query", () => {
    searchState.actions.setQuery("   ");
    ok(!searchState.selectors.isSearching());
  });
});

describe("searchState: index", () => {
  test("setIndex sets the flat index", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Google", url: "https://google.com", folderPath: "" },
    ]);
    const index = searchState.selectors.getIndex();
    strictEqual(index.length, 1);
    strictEqual(index[0].title, "Google");
  });

  test("patchBookmark updates title in index", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Old", url: "https://old.com", folderPath: "" },
    ]);
    searchState.actions.patchBookmark("1", { title: "New" });
    const index = searchState.selectors.getIndex();
    strictEqual(index[0].title, "New");
    strictEqual(index[0].url, "https://old.com");
  });

  test("patchBookmark updates URL in index", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Test", url: "https://old.com", folderPath: "" },
    ]);
    searchState.actions.patchBookmark("1", { url: "https://new.com" });
    const index = searchState.selectors.getIndex();
    strictEqual(index[0].url, "https://new.com");
    strictEqual(index[0].title, "Test");
  });

  test("patchBookmark does not update when entry not found", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Test", url: "https://test.com", folderPath: "" },
    ]);
    searchState.actions.patchBookmark("999", { title: "Nope" });
    const index = searchState.selectors.getIndex();
    strictEqual(index[0].title, "Test");
  });

  test("patchBookmark no-ops when patch has no title or url", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Test", url: "https://test.com", folderPath: "" },
    ]);
    const before = searchState.selectors.getIndex();
    searchState.actions.patchBookmark("1", {});
    const after = searchState.selectors.getIndex();
    strictEqual(before, after);
  });

  test("addBookmark appends new entry to index", () => {
    searchState.actions.setIndex([]);
    searchState.actions.addBookmark({
      nodeId: "1", title: "New", url: "https://new.com", folderPath: "",
    });
    const index = searchState.selectors.getIndex();
    strictEqual(index.length, 1);
    strictEqual(index[0].title, "New");
  });

  test("addBookmark replaces existing entry with same nodeId", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Old", url: "https://old.com", folderPath: "" },
    ]);
    searchState.actions.addBookmark({
      nodeId: "1", title: "New", url: "https://new.com", folderPath: "",
    });
    const index = searchState.selectors.getIndex();
    strictEqual(index.length, 1);
    strictEqual(index[0].title, "New");
    strictEqual(index[0].url, "https://new.com");
  });

  test("addBookmark skips entry with empty nodeId", () => {
    searchState.actions.setIndex([]);
    searchState.actions.addBookmark({
      nodeId: "", title: "Nope", url: "https://nope.com", folderPath: "",
    });
    strictEqual(searchState.selectors.getIndex().length, 0);
  });

  test("patchBookmarkFolderPath updates folderPath in index", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Test", url: "https://test.com", folderPath: "" },
    ]);
    searchState.actions.patchBookmarkFolderPath("1", "Root / Subfolder");
    const index = searchState.selectors.getIndex();
    strictEqual(index[0].folderPath, "Root / Subfolder");
  });
});

describe("searchState: results (debounced)", () => {
  test.beforeEach(installInstantTimers);
  test.afterEach(restoreRealTimers);

  test("getResults returns empty array when index is empty", () => {
    searchState.actions.setIndex([]);
    searchState.actions.setQuery("anything");
    deepEqual(searchState.selectors.getResults(), []);
  });

  test("getResults returns empty array when query is empty", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Google", url: "https://google.com", folderPath: "" },
    ]);
    searchState.actions.clearQuery();
    deepEqual(searchState.selectors.getResults(), []);
  });

  test("getResults returns matching entries by title", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Google", url: "https://google.com", folderPath: "" },
      { nodeId: "2", title: "GitHub", url: "https://github.com", folderPath: "" },
    ]);
    searchState.actions.setQuery("goog");
    const results = searchState.selectors.getResults();
    strictEqual(results.length, 1);
    strictEqual(results[0].title, "Google");
  });

  test("getResults returns matching entries by URL", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Example", url: "https://example.com", folderPath: "" },
    ]);
    searchState.actions.setQuery("example.com");
    const results = searchState.selectors.getResults();
    strictEqual(results.length, 1);
  });

  test("getResults is case-insensitive", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "Google", url: "https://google.com", folderPath: "" },
    ]);
    searchState.actions.setQuery("GOOG");
    const results = searchState.selectors.getResults();
    strictEqual(results.length, 1);
  });

  test("getResults reflects index changes reactively", () => {
    searchState.actions.setIndex([
      { nodeId: "1", title: "A", url: "https://a.com", folderPath: "" },
      { nodeId: "2", title: "B", url: "https://b.com", folderPath: "" },
    ]);
    searchState.actions.setQuery("a");
    const results = searchState.selectors.getResults();
    strictEqual(results.length, 1);
    strictEqual(results[0].title, "A");
  });
});
