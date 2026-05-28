// @ts-check

import { trapFocusInContainer } from "../../shared/infra/focus.js";
import { effect } from "../../shared/runtime/naf-html.js";
import { uiState } from "../../shared/state/ui-state.js";

/**
 * @param {ParentNode} root
 * @returns {{ container: HTMLElement }}
 */
export function collectConfirmModalShell(root) {
  const container = root.querySelector("#confirm-modal-container");
  if (!(container instanceof HTMLElement)) {
    throw new Error("Expected #confirm-modal-container element");
  }

  return { container };
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountConfirmModal(shell) {
  let cleanupRendered = () => {};

  const stop = effect(() => {
    cleanupRendered();
    cleanupRendered = () => {};

    shell.container.replaceChildren();

    const modal = uiState.selectors.getModal();
    if (!modal.open) {
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "modal confirm-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    dialog.setAttribute("data-focus-zone", "dialog");

    const body = document.createElement("div");
    body.className = "modal__body confirm-modal__body";

    const title = document.createElement("h3");
    title.className = "shell-panel__title";
    title.textContent = modal.title;

    const message = document.createElement("p");
    message.className = "confirm-modal__message";
    message.textContent = modal.message;

    body.append(title, message);

    const footer = document.createElement("div");
    footer.className = "modal__footer";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn-ghost btn-sm";
    cancelButton.textContent = "Cancel";
    cancelButton.setAttribute("data-keyboard-action", "modal-cancel");

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "btn btn-danger btn-sm";
    confirmButton.textContent = modal.confirmLabel;
    confirmButton.setAttribute("data-keyboard-action", "modal-confirm");

    footer.append(cancelButton, confirmButton);
    dialog.append(body, footer);
    backdrop.append(dialog);
    shell.container.append(backdrop);

    const handleBackdropClick = () => {
      uiState.actions.closeModal();
    };
    const handleDialogClick = (event) => {
      event.stopPropagation();
    };
    const handleCancelClick = () => {
      uiState.actions.closeModal();
    };
    const handleConfirmClick = () => {
      void uiState.actions.confirmModal();
    };
    /** @param {KeyboardEvent} event */
    const handleDialogKeydown = (event) => {
      if (trapFocusInContainer(event, dialog)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        uiState.actions.closeModal();
      }
    };

    backdrop.addEventListener("click", handleBackdropClick);
    dialog.addEventListener("click", handleDialogClick);
    dialog.addEventListener("keydown", handleDialogKeydown);
    cancelButton.addEventListener("click", handleCancelClick);
    confirmButton.addEventListener("click", handleConfirmClick);

    queueMicrotask(() => {
      cancelButton.focus();
    });

    cleanupRendered = () => {
      backdrop.removeEventListener("click", handleBackdropClick);
      dialog.removeEventListener("click", handleDialogClick);
      dialog.removeEventListener("keydown", handleDialogKeydown);
      cancelButton.removeEventListener("click", handleCancelClick);
      confirmButton.removeEventListener("click", handleConfirmClick);
    };
  });

  return {
    cleanup() {
      cleanupRendered();
      stop();
    },
  };
}
