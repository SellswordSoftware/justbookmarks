// @ts-check

import { describe, test } from "../lib/test.js";
import { strictEqual } from "../lib/assert.js";
import { getErrorMessage } from "../../src/shared/infra/errors.js";

describe("getErrorMessage", () => {
  test("returns message from Error instance", () => {
    strictEqual(getErrorMessage(new Error("file not found")), "file not found");
  });

  test("returns string directly for string input", () => {
    strictEqual(getErrorMessage("something went wrong"), "something went wrong");
  });

  test("returns fallback for null input", () => {
    strictEqual(getErrorMessage(null), "Unexpected error");
  });

  test("returns fallback for undefined input", () => {
    strictEqual(getErrorMessage(undefined), "Unexpected error");
  });

  test("returns fallback for non-error object", () => {
    strictEqual(getErrorMessage({ code: 500 }), "Unexpected error");
  });

  test("returns fallback for empty string", () => {
    strictEqual(getErrorMessage(""), "Unexpected error");
  });

  test("returns custom fallback", () => {
    strictEqual(getErrorMessage(null, "custom fallback"), "custom fallback");
  });

  test("returns message from custom Error subclass", () => {
    class CustomError extends Error {
      /** @param {string} message */
      constructor(message) {
        super(message);
        this.name = "CustomError";
      }
    }
    strictEqual(getErrorMessage(new CustomError("custom error")), "custom error");
  });

  test("ignores fallback when error has message", () => {
    strictEqual(getErrorMessage(new Error("real error"), "fallback"), "real error");
  });
});
