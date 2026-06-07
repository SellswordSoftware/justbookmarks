// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, strictEqual } from "../lib/assert.js";
import { installStrictImportDOM } from "../lib/node-dom-shim.js";

describe("strict Node DOM shim", () => {
  test("supports minimal import-time element creation", () => {
    installStrictImportDOM();

    const el = document.createElement("div");
    strictEqual(el.tagName, "DIV");
    strictEqual(el.textContent, "");
    el.textContent = "hello";
    strictEqual(el.textContent, "hello");
  });

  test("throws on unsupported DOM behavior", () => {
    installStrictImportDOM();

    const el = document.createElement("div");
    let error = null;
    try {
      el.appendChild(document.createElement("span"));
    } catch (thrown) {
      error = thrown;
    }

    ok(error instanceof Error);
    ok(error.message.includes("Unsupported DOM operation in Node test harness"));
    ok(error.message.includes("Move this test to tests/browser"));
  });
});
