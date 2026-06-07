// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual } from "../lib/assert.js";
import { normalizeFlat } from "../../src/features/tree/state/normalize-flat.js";

describe("normalizeFlat", () => {
  test("returns empty array for null input", () => {
    deepEqual(normalizeFlat(null), []);
  });

  test("returns empty array for undefined input", () => {
    deepEqual(normalizeFlat(undefined), []);
  });

  test("returns empty array for empty array", () => {
    deepEqual(normalizeFlat([]), []);
  });

  test("converts flat root nodes", () => {
    const result = normalizeFlat([
      {
        id: "bm-1",
        type: 1,
        parentId: "",
        name: "GitHub",
        url: "https://github.com",
        icon: "",
        iconURI: "",
        addDate: "",
        lastModified: "",
        meta: "",
        childCount: 0,
      },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].type, 1);
    strictEqual(result[0].id, "bm-1");
    strictEqual(result[0].bookmark.title, "GitHub");
    strictEqual(result[0].bookmark.url, "https://github.com");
  });

  test("converts flat nested nodes", () => {
    const result = normalizeFlat([
      {
        id: "f-1",
        type: 0,
        parentId: "",
        name: "Work",
        url: "",
        icon: "",
        iconURI: "",
        addDate: "",
        lastModified: "",
        meta: "",
        childCount: 1,
      },
      {
        id: "bm-1",
        type: 1,
        parentId: "f-1",
        name: "GitHub",
        url: "https://github.com",
        icon: "",
        iconURI: "",
        addDate: "",
        lastModified: "",
        meta: "",
        childCount: 0,
      },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].type, 0);
    strictEqual(result[0].id, "f-1");
    equal(result[0].folder.children.length, 1);
    strictEqual(result[0].folder.children[0].id, "bm-1");
    strictEqual(result[0].folder.children[0].bookmark.title, "GitHub");
  });

  test("handles deeply nested hierarchies", () => {
    const result = normalizeFlat([
      { id: "f-1", type: 0, parentId: "", name: "Root", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 1 },
      { id: "f-2", type: 0, parentId: "f-1", name: "Level 1", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 1 },
      { id: "f-3", type: 0, parentId: "f-2", name: "Level 2", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 1 },
      { id: "bm-1", type: 1, parentId: "f-3", name: "Deep", url: "https://deep.com", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 0 },
    ]);

    equal(result.length, 1);
    const level1 = result[0].folder.children[0];
    const level2 = level1.folder.children[0];
    const deep = level2.folder.children[0];
    strictEqual(level1.folder.name, "Level 1");
    strictEqual(level2.folder.name, "Level 2");
    strictEqual(deep.bookmark.title, "Deep");
  });

  test("handles folders with zero children", () => {
    const result = normalizeFlat([
      { id: "f-1", type: 0, parentId: "", name: "Empty", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 0 },
    ]);

    ok(result[0].folder.childrenLoaded);
    equal(result[0].folder.children.length, 0);
  });

  test("handles folders with childCount > 0", () => {
    const result = normalizeFlat([
      { id: "f-1", type: 0, parentId: "", name: "Has Children", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 5 },
    ]);

    ok(!result[0].folder.childrenLoaded);
    equal(result[0].folder.childCount, 5);
  });

  test("falls back to root when parent not found", () => {
    const result = normalizeFlat([
      { id: "bm-1", type: 1, parentId: "missing-parent", name: "Orphan", url: "https://orphan.com", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 0 },
    ]);

    equal(result.length, 1);
    strictEqual(result[0].id, "bm-1");
  });

  test("sets correct default values for missing fields", () => {
    const result = normalizeFlat([
      { id: "bm-1", type: 1, parentId: "", name: "Minimal", url: "https://minimal.com" },
    ]);

    strictEqual(result[0].bookmark.icon, "");
    strictEqual(result[0].bookmark.iconURI, "");
    strictEqual(result[0].bookmark.addDate, "");
    strictEqual(result[0].bookmark.lastModified, "");
    strictEqual(result[0].bookmark.meta, "");
  });

  test("preserves folder childCount", () => {
    const result = normalizeFlat([
      { id: "f-1", type: 0, parentId: "", name: "Folder", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 10 },
    ]);

    equal(result[0].folder.childCount, 10);
  });

  test("handles multiple root nodes", () => {
    const result = normalizeFlat([
      { id: "f-1", type: 0, parentId: "", name: "A", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 0 },
      { id: "f-2", type: 0, parentId: "", name: "B", url: "", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 0 },
      { id: "bm-1", type: 1, parentId: "", name: "C", url: "https://c.com", icon: "", iconURI: "", addDate: "", lastModified: "", meta: "", childCount: 0 },
    ]);

    equal(result.length, 3);
    strictEqual(result[0].folder.name, "A");
    strictEqual(result[1].folder.name, "B");
    strictEqual(result[2].bookmark.title, "C");
  });
});
