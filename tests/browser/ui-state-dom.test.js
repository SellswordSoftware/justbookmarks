// @ts-nocheck

/**
 * Browser tests for ui-state timer-based behavior.
 *
 * Focuses on:
 * - Toast auto-removal after duration
 * - Multiple toasts displayed simultaneously
 * - Toast types render correct CSS classes
 * - Confirm modal state transitions are reactive
 *
 * Run via: cd frontend && npm run test:browser
 */

import { describe, test } from "../lib/test.js";
import { strictEqual, ok } from "../lib/assert.js";
import { uiState } from "../../src/shared/state/ui-state.js";

describe("uiState: toast auto-removal", () => {
  test("toast is auto-removed after short duration", async () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("Auto-remove", "info", 100);
    strictEqual(uiState.selectors.getToasts().length, 1);
    await new Promise((r) => setTimeout(r, 200));
    strictEqual(uiState.selectors.getToasts().length, 0);
  });

  test("removeToast cancels auto-removal timer", async () => {
    uiState.actions.clearToasts();
    const id = uiState.actions.showToast("Cancel", "info", 100);
    uiState.actions.removeToast(id);
    await new Promise((r) => setTimeout(r, 200));
    strictEqual(uiState.selectors.getToasts().length, 0);
  });
});

describe("uiState: multiple toasts", () => {
  test("multiple toasts are displayed simultaneously", () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("First", "info", 5000);
    uiState.actions.showToast("Second", "success", 5000);
    uiState.actions.showToast("Third", "warning", 5000);
    const toasts = uiState.selectors.getToasts();
    strictEqual(toasts.length, 3);
    strictEqual(toasts[0].message, "First");
    strictEqual(toasts[1].message, "Second");
    strictEqual(toasts[2].message, "Third");
  });

  test("clearToasts removes all pending timers", async () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("A", "info", 100);
    uiState.actions.showToast("B", "info", 100);
    uiState.actions.clearToasts();
    await new Promise((r) => setTimeout(r, 200));
    strictEqual(uiState.selectors.getToasts().length, 0);
  });
});

describe("uiState: toast types", () => {
  test("info toast has correct type", () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("Info", "info", 5000);
    strictEqual(uiState.selectors.getToasts()[0].type, "info");
  });

  test("success toast has correct type", () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("Success", "success", 5000);
    strictEqual(uiState.selectors.getToasts()[0].type, "success");
  });

  test("warning toast has correct type", () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("Warning", "warning", 5000);
    strictEqual(uiState.selectors.getToasts()[0].type, "warning");
  });

  test("error toast has correct type", () => {
    uiState.actions.clearToasts();
    uiState.actions.showToast("Error", "error", 5000);
    strictEqual(uiState.selectors.getToasts()[0].type, "error");
  });
});

describe("uiState: confirm modal reactive", () => {
  test("modal state transitions are reactive", () => {
    uiState.actions.closeModal();
    ok(!uiState.selectors.getModal().open);

    uiState.actions.showConfirm("Title", "Message");
    ok(uiState.selectors.getModal().open);
    strictEqual(uiState.selectors.getModal().title, "Title");

    uiState.actions.closeModal();
    ok(!uiState.selectors.getModal().open);
  });

  test("confirmModal executes callback and closes", async () => {
    /** @type {boolean} */
    let confirmed = false;
    uiState.actions.closeModal();
    uiState.actions.showConfirm("Title", "Message", "OK", async () => {
      confirmed = true;
    });
    await uiState.actions.confirmModal();
    ok(confirmed);
    ok(!uiState.selectors.getModal().open);
  });
});
