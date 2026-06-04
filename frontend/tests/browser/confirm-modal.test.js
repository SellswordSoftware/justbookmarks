// @ts-nocheck

/**
 * Browser tests for confirm-modal DOM rendering and lifecycle.
 *
 * Focuses on:
 * - Modal renders with correct title/message
 * - Modal renders with custom/default confirm label
 * - Modal has cancel/confirm buttons
 * - Modal has correct ARIA attributes
 * - Modal cleanup removes DOM
 *
 * Run via: cd frontend && npm run test:browser
 */

import { describe, test } from "../lib/test.js";
import { ok, strictEqual } from "../lib/assert.js";
import { uiState } from "../../src/shared/state/ui-state.js";
import { mountConfirmModal } from "../../src/components/confirm-modal/confirm-modal.js";

/** @returns {HTMLElement} */
function createHost() {
  const host = document.createElement("div");
  host.innerHTML = '<div id="confirm-modal-container"></div>';
  return host;
}

describe("confirm-modal: rendering", () => {
  test("modal renders with correct title", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Test Title", "Test Message");
    const title = host.querySelector(".shell-panel__title");
    ok(title);
    strictEqual(title?.textContent, "Test Title");
    uiState.actions.closeModal();
  });

  test("modal renders with correct message", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Test Message");
    const message = host.querySelector(".confirm-modal__message");
    ok(message);
    strictEqual(message?.textContent, "Test Message");
    uiState.actions.closeModal();
  });

  test("modal renders with custom confirm label", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Message", "Delete Now");
    const label = host.querySelector("[data-ref='confirmLabel']");
    ok(label);
    strictEqual(label?.textContent, "Delete Now");
    uiState.actions.closeModal();
  });

  test("modal renders with default confirm label", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Message");
    const label = host.querySelector("[data-ref='confirmLabel']");
    ok(label);
    strictEqual(label?.textContent, "OK");
    uiState.actions.closeModal();
  });
});

describe("confirm-modal: buttons", () => {
  test("modal has cancel button", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Message");
    const cancelBtn = host.querySelector("[data-keyboard-action='modal-cancel']");
    ok(cancelBtn);
    ok(cancelBtn?.textContent.includes("Cancel"));
    uiState.actions.closeModal();
  });

  test("modal has confirm button", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Message");
    const confirmBtn = host.querySelector("[data-keyboard-action='modal-confirm']");
    ok(confirmBtn);
    uiState.actions.closeModal();
  });
});

describe("confirm-modal: ARIA", () => {
  test("modal has correct ARIA attributes", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Message");
    const dialog = host.querySelector('[role="dialog"]');
    ok(dialog);
    strictEqual(dialog?.getAttribute("aria-modal"), "true");
    uiState.actions.closeModal();
  });
});

describe("confirm-modal: lifecycle", () => {
  test("modal cleanup removes DOM", () => {
    const host = createHost();
    const { cleanup } = mountConfirmModal(host);
    uiState.actions.showConfirm("Title", "Message");
    ok(host.querySelector(".confirm-modal"));
    cleanup();
    ok(!host.querySelector(".confirm-modal"));
  });

  test("modal is hidden when closed", () => {
    const host = createHost();
    mountConfirmModal(host);
    uiState.actions.closeModal();
    ok(!host.querySelector(".confirm-modal"));
  });

  test("modal appears and disappears reactively", () => {
    const host = createHost();
    mountConfirmModal(host);
    ok(!host.querySelector(".confirm-modal"));

    uiState.actions.showConfirm("Title", "Message");
    ok(host.querySelector(".confirm-modal"));

    uiState.actions.closeModal();
    ok(!host.querySelector(".confirm-modal"));
  });
});
