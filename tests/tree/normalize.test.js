// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, deepEqual, strictEqual } from "../lib/assert.js";
import { normalizeTree } from "../../src/features/tree/state/normalize.js";

describe("normalizeTree", () => {
  test("returns empty array for null input", () => {
    deepEqual(normalizeTree(null), []);
  });

  test("returns empty array for undefined input", () => {
    deepEqual(normalizeTree(undefined), []);
  });

  test("returns empty array for non-array input", () => {
    deepEqual(normalizeTree({}), []);
    deepEqual(normalizeTree("hello"), []);
    deepEqual(normalizeTree(42), []);
  });

  test("returns empty array for empty array", () => {
    deepEqual(normalizeTree([]), []);
  });

  test("normalizes a folder node with all fields", () => {
    const result = normalizeTree([
      {
        type: 0,
        folder: {
          id: "f-1",
          name: "Work",
          icon: "folder-icon",
          addDate: "2024-01-01",
          lastModified: "2024-01-02",
          meta: "work-meta",
          children: [],
        },
      },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].type, 0);
    strictEqual(result[0].id, "f-1");
    strictEqual(result[0].folder.name, "Work");
    strictEqual(result[0].folder.icon, "folder-icon");
    strictEqual(result[0].folder.addDate, "2024-01-01");
    strictEqual(result[0].folder.lastModified, "2024-01-02");
    strictEqual(result[0].folder.meta, "work-meta");
    deepEqual(result[0].folder.children, []);
    equal(result[0].folder.childCount, 0);
    ok(result[0].folder.childrenLoaded);
  });

  test("normalizes a folder node with missing optional fields", () => {
    const result = normalizeTree([
      {
        type: 0,
        folder: {
          id: "f-1",
          name: "Work",
        },
      },
    ]);

    strictEqual(result[0].folder.icon, "");
    strictEqual(result[0].folder.addDate, "");
    strictEqual(result[0].folder.lastModified, "");
    strictEqual(result[0].folder.meta, "");
    deepEqual(result[0].folder.children, []);
    equal(result[0].folder.childCount, 0);
    ok(result[0].folder.childrenLoaded);
  });

  test("normalizes a bookmark node with all fields", () => {
    const result = normalizeTree([
      {
        type: 1,
        bookmark: {
          id: "bm-1",
          title: "GitHub",
          url: "https://github.com",
          icon: "github-icon",
          iconURI: "https://github.com/favicon.ico",
          addDate: "2024-01-01",
          lastModified: "2024-01-02",
          meta: "dev-meta",
        },
      },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].type, 1);
    strictEqual(result[0].id, "bm-1");
    strictEqual(result[0].bookmark.title, "GitHub");
    strictEqual(result[0].bookmark.url, "https://github.com");
    strictEqual(result[0].bookmark.icon, "github-icon");
    strictEqual(result[0].bookmark.iconURI, "https://github.com/favicon.ico");
    strictEqual(result[0].bookmark.addDate, "2024-01-01");
    strictEqual(result[0].bookmark.lastModified, "2024-01-02");
    strictEqual(result[0].bookmark.meta, "dev-meta");
  });

  test("normalizes a bookmark node with missing optional fields", () => {
    const result = normalizeTree([
      {
        type: 1,
        bookmark: {
          id: "bm-1",
          title: "GitHub",
        },
      },
    ]);

    strictEqual(result[0].bookmark.url, "");
    strictEqual(result[0].bookmark.icon, "");
    strictEqual(result[0].bookmark.iconURI, "");
    strictEqual(result[0].bookmark.addDate, "");
    strictEqual(result[0].bookmark.lastModified, "");
    strictEqual(result[0].bookmark.meta, "");
  });

  test("recursively normalizes nested folder children", () => {
    const result = normalizeTree([
      {
        type: 0,
        folder: {
          id: "f-root",
          name: "Root",
          children: [
            {
              type: 0,
              folder: {
                id: "f-child",
                name: "Child",
                children: [
                  {
                    type: 1,
                    bookmark: {
                      id: "bm-deep",
                      title: "Deep Bookmark",
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    equal(result.length, 1);
    equal(result[0].folder.children.length, 1);
    strictEqual(result[0].folder.children[0].folder.name, "Child");
    equal(result[0].folder.children[0].folder.children.length, 1);
    strictEqual(result[0].folder.children[0].folder.children[0].bookmark.title, "Deep Bookmark");
    ok(result[0].folder.children[0].folder.childrenLoaded);
  });

  test("skips nodes with missing IDs", () => {
    const result = normalizeTree([
      {
        type: 0,
        folder: {
          id: "",
          name: "No ID Folder",
        },
      },
      {
        type: 1,
        bookmark: {
          title: "No ID Bookmark",
        },
      },
      {
        type: 1,
        bookmark: {
          id: "bm-valid",
          title: "Valid Bookmark",
        },
      },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].id, "bm-valid");
  });

  test("skips nodes with invalid type values", () => {
    const result = normalizeTree([
      {
        type: 2,
        folder: {
          id: "invalid",
          name: "Invalid",
        },
      },
    ]);

    equal(result.length, 0);
  });

  test("skips null nodes in array", () => {
    const result = normalizeTree([
      null,
      undefined,
      {
        type: 1,
        bookmark: {
          id: "bm-1",
          title: "Valid",
        },
      },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].id, "bm-1");
  });

  test("sets childCount from children array length", () => {
    const result = normalizeTree([
      {
        type: 0,
        folder: {
          id: "f-1",
          name: "Parent",
          children: [
            { type: 1, bookmark: { id: "bm-1", title: "A" } },
            { type: 1, bookmark: { id: "bm-2", title: "B" } },
          ],
        },
      },
    ]);

    equal(result[0].folder.childCount, 2);
  });

  test("sets childCount to 0 when children is not an array", () => {
    const result = normalizeTree([
      {
        type: 0,
        folder: {
          id: "f-1",
          name: "Parent",
          children: null,
        },
      },
    ]);

    equal(result[0].folder.childCount, 0);
    deepEqual(result[0].folder.children, []);
  });
});
