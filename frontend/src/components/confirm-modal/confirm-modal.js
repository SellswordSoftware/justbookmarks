// @ts-check

import { trapFocusInContainer } from "../../shared/infra/focus.js";
import { cleanupCollector, effect, listener, mount, requireElement, requireRef, template, when } from "../../shared/runtime/naf.js";
import { uiState } from "../../shared/state/ui-state.js";

/**
 * @param {ReturnType<typeof uiState.selectors.getModal>} modal
 * @returns {Component<HTMLElement>}
 */
function createConfirmModal(modal) {
  const renderConfirmModal =
    /** @type {TemplateTag} */ (
      template({
        onMount(_el, _parent, ctx) {
          const backdrop = /** @type {HTMLDivElement} */ (requireRef(ctx.refs, "backdrop"));
          const dialog = /** @type {HTMLDivElement} */ (requireRef(ctx.refs, "dialog"));
          const title = /** @type {HTMLElement} */ (requireRef(ctx.refs, "title"));
          const message = /** @type {HTMLElement} */ (requireRef(ctx.refs, "message"));
          const cancelButton = /** @type {HTMLButtonElement} */ (requireRef(ctx.refs, "cancelButton"));
          const confirmButton = /** @type {HTMLButtonElement} */ (requireRef(ctx.refs, "confirmButton"));
          const confirmLabel = /** @type {HTMLElement} */ (requireRef(ctx.refs, "confirmLabel"));

          title.textContent = modal.title;
          message.textContent = modal.message;
          confirmLabel.textContent = modal.confirmLabel;

          const handleBackdropClick = () => {
            uiState.actions.closeModal();
          };
          /** @param {MouseEvent} event */
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

          queueMicrotask(() => {
            cancelButton.focus();
          });

          const cleanup = cleanupCollector(
            listener(backdrop, "click", handleBackdropClick),
            listener(dialog, "click", handleDialogClick),
            listener(dialog, "keydown", handleDialogKeydown),
            listener(cancelButton, "click", handleCancelClick),
            listener(confirmButton, "click", handleConfirmClick),
          );

          createConfirmModalCleanup = () => {
            cleanup.run();
          };
        },
        onUnmount() {
          createConfirmModalCleanup();
          createConfirmModalCleanup = () => {};
        },
      })
    );

  let createConfirmModalCleanup = () => {};

  return renderConfirmModal /*html*/ `
    <div class="modal-backdrop" role="presentation" data-ref="backdrop">
      <div
        class="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        data-focus-zone="dialog"
        data-ref="dialog"
      >
        <div class="modal__body confirm-modal__body">
          <h3 class="shell-panel__title" data-ref="title"></h3>
          <p class="confirm-modal__message" data-ref="message"></p>
        </div>
        <div class="modal__footer">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-keyboard-action="modal-cancel"
            data-ref="cancelButton"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            data-keyboard-action="modal-confirm"
            data-ref="confirmButton"
          >
            <span data-ref="confirmLabel"></span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * @param {ParentNode} root
 * @returns {{ cleanup: () => void }}
 */
export function mountConfirmModal(root) {
  const container = /** @type {HTMLElement} */ (requireElement(root, "#confirm-modal-container", "confirm-modal-container"));
  const renderShell = /** @type {TemplateTag} */ (template);

  const component = renderShell`
    ${when(
      () => uiState.selectors.getModal(),
      (modal) => modal.open ? createConfirmModal(modal) : createEmptyComponent(),
      () => createEmptyComponent(),
    )}
  `;

  mount(component, container);

  return {
    cleanup() {
      component.unmount?.();
    },
  };
}

/** @returns {Component} */
function createEmptyComponent() {
  return {
    html: '',
    refs: {},
    mount() {},
    unmount() {},
  };
}
