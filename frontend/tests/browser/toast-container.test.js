// @ts-nocheck

/**
 * Browser tests for toast-container DOM rendering and lifecycle.
 *
 * Focuses on:
 * - Toasts render with correct message
 * - Toasts render with correct type classes
 * - Toasts render with correct icons
 * - Multiple toasts render simultaneously
 * - Empty toast list renders nothing
 * - Toast cleanup removes DOM
 *
 * Run via: cd frontend && npm run test:browser
 */

import { describe, test } from "../lib/test.js";
import { ok, strictEqual } from "../lib/assert.js";
import { uiState } from "../../src/shared/state/ui-state.js";
import { mountToastContainer } from "../../src/components/toast/toast-container.js";

/** @returns {HTMLElement} */
function createHost() {
  const host = document.createElement("div");
  host.innerHTML = '<div id="toast-container"></div>';
  return host;
}

describe("toast-container: rendering", () => {
  test("toasts render with correct message", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.clearToasts();
    uiState.actions.showToast("Hello World", "info", 5000);
    const messages = host.querySelectorAll("[data-ref='message']");
    ok(messages.length > 0);
    strictEqual(messages[0]?.textContent, "Hello World");
    uiState.actions.clearToasts();
  });

  test("info toast has alert-info class", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("Info", "info", 5000);
    const alert = host.querySelector(".alert-info");
    ok(alert);
    uiState.actions.clearToasts();
  });

  test("success toast has alert-success class", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("Success", "success", 5000);
    const alert = host.querySelector(".alert-success");
    ok(alert);
    uiState.actions.clearToasts();
  });

  test("error toast has alert-error class", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("Error", "error", 5000);
    const alert = host.querySelector(".alert-error");
    ok(alert);
    uiState.actions.clearToasts();
  });

  test("warning toast has alert-warning class", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("Warning", "warning", 5000);
    const alert = host.querySelector(".alert-warning");
    ok(alert);
    uiState.actions.clearToasts();
  });
});

describe("toast-container: multiple toasts", () => {
  test("multiple toasts render simultaneously", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("First", "info", 5000);
    uiState.actions.showToast("Second", "info", 5000);
    const toasts = host.querySelectorAll(".toast");
    strictEqual(toasts.length, 2);
    uiState.actions.clearToasts();
  });

  test("empty toast list renders nothing", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.clearToasts();
    const toasts = host.querySelectorAll(".toast");
    strictEqual(toasts.length, 0);
  });
});

describe("toast-container: icons", () => {
  test("toasts render with icon elements", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("Test", "info", 5000);
    const icon = host.querySelector("[data-ref='icon']");
    ok(icon);
    ok(icon?.innerHTML.includes("svg"));
    uiState.actions.clearToasts();
  });

  test("success toast has checkmark icon", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.showToast("Success", "success", 5000);
    const icon = host.querySelector("[data-ref='icon']");
    ok(icon);
    ok(icon?.innerHTML.includes("M9 12l2 2 4-4"));
    uiState.actions.clearToasts();
  });
});

describe("toast-container: lifecycle", () => {
  test("toast cleanup removes DOM", () => {
    const host = createHost();
    const { cleanup } = mountToastContainer(host);
    uiState.actions.showToast("Test", "info", 5000);
    ok(host.querySelector(".toast"));
    cleanup();
    ok(!host.querySelector(".toast"));
    uiState.actions.clearToasts();
  });

  test("toasts appear and disappear reactively", () => {
    const host = createHost();
    mountToastContainer(host);
    uiState.actions.clearToasts();
    ok(!host.querySelector(".toast"));

    uiState.actions.showToast("Appears", "info", 5000);
    ok(host.querySelector(".toast"));

    uiState.actions.clearToasts();
    ok(!host.querySelector(".toast"));
  });
});
