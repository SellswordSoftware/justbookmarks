// @ts-check

import { describe, test } from "../lib/test.js";
import { strictEqual, ok, deepEqual } from "../lib/assert.js";
import { uiState } from "../../src/shared/state/ui-state.js";

describe("uiState: toasts", () => {
  test("showToast adds a toast to the queue", () => {
    uiState.actions.clearToasts();
    const id = uiState.actions.showToast("Hello", "info");
    const toasts = uiState.selectors.getToasts();
    strictEqual(toasts.length, 1);
    strictEqual(toasts[0].message, "Hello");
    strictEqual(toasts[0].type, "info");
    strictEqual(toasts[0].id, id);
  });

  test("showToast returns a unique ID", () => {
    uiState.actions.clearToasts();
    const id1 = uiState.actions.showToast("A");
    const id2 = uiState.actions.showToast("B");
    ok(id1 !== id2);
  });

  test("removeToast removes a toast by ID", () => {
    uiState.actions.clearToasts();
    const id = uiState.actions.showToast("Test");
    uiState.actions.removeToast(id);
    strictEqual(uiState.selectors.getToasts().length, 0);
  });

  test("clearToasts removes all toasts", () => {
    uiState.actions.showToast("A");
    uiState.actions.showToast("B");
    uiState.actions.showToast("C");
    uiState.actions.clearToasts();
    strictEqual(uiState.selectors.getToasts().length, 0);
  });
});

describe("uiState: confirm modal", () => {
  test("showConfirm opens the confirm modal", () => {
    uiState.actions.closeModal();
    const modal = uiState.actions.showConfirm("Title", "Message");
    ok(modal.open);
    strictEqual(modal.title, "Title");
    strictEqual(modal.message, "Message");
  });

  test("closeModal closes the confirm modal", () => {
    uiState.actions.showConfirm("Title", "Message");
    const modal = uiState.actions.closeModal();
    ok(!modal.open);
    strictEqual(modal.title, "");
    strictEqual(modal.message, "");
  });

  test("getModal returns the current modal state", () => {
    uiState.actions.closeModal();
    const modal = uiState.selectors.getModal();
    ok(!modal.open);
  });

  test("showConfirm accepts custom confirm label", () => {
    uiState.actions.closeModal();
    const modal = uiState.actions.showConfirm("Title", "Message", "Delete");
    strictEqual(modal.confirmLabel, "Delete");
  });

  test("showConfirm accepts custom onConfirm callback", async () => {
    /** @type {boolean} */
    let called = false;
    uiState.actions.closeModal();
    uiState.actions.showConfirm("Title", "Message", "OK", async () => {
      called = true;
    });
    await uiState.actions.confirmModal();
    ok(called);
    ok(!uiState.selectors.getModal().open);
  });

  test("confirmModal closes modal even if onConfirm throws", async () => {
    uiState.actions.closeModal();
    uiState.actions.showConfirm("Title", "Message", "OK", async () => {
      throw new Error("test error");
    });
    try {
      await uiState.actions.confirmModal();
    } catch {
      // Expected
    }
    ok(!uiState.selectors.getModal().open);
  });
});
