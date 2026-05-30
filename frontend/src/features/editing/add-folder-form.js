// @ts-check

import { AddFolder } from "../../shared/api/api.js";
import {
  cleanupCollector,
  effect,
  fx,
  model,
  signal,
  template,
} from "../../shared/runtime/naf.js";
import { getErrorMessage } from "../../shared/infra/errors.js";
import { appState } from "../../shared/state/app-state.js";
import { treeState } from "../tree/state/tree-state.js";
import { uiState } from "../../shared/state/ui-state.js";

/**
 * @typedef {object} AddFolderFormOptions
 * @property {string} triggerLabel
 * @property {string=} triggerClassName
 * @property {string=} formTitle
 * @property {string=} submitLabel
 * @property {string=} triggerKeyboardAction
 * @property {string=} triggerAriaLabel
 * @property {string=} triggerTitle
 * @property {string=} triggerIconClassName
 * @property {() => string} getParentFolderId
 * @property {() => boolean=} isAvailable
 * @property {(() => void)=} onAdded
 */

/**
 * @param {AddFolderFormOptions} options
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
export function createAddFolderForm(options) {
  const open = signal(false);
  const busy = signal(false);
  const name = signal("");
  const errorMessage = signal("");
  const cleanup = cleanupCollector();

  const renderAddFolderForm = /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (
    template({
      root: ".add-folder-launcher",
      onMount(_el, _parent, ctx) {
        const trigger = ctx.refs.trigger;
        const panel = ctx.refs.panel;
        const input = ctx.refs.input;
        const error = ctx.refs.error;
        const submit = ctx.refs.submit;
        const cancel = ctx.refs.cancel;

        if (!(trigger instanceof HTMLButtonElement)) {
          throw new Error("Expected add folder trigger button");
        }
        if (!(panel instanceof HTMLElement)) {
          throw new Error("Expected add folder panel");
        }
        if (!(input instanceof HTMLInputElement)) {
          throw new Error("Expected add folder input");
        }
        if (!(error instanceof HTMLElement)) {
          throw new Error("Expected add folder error element");
        }
        if (!(submit instanceof HTMLButtonElement)) {
          throw new Error("Expected add folder submit button");
        }
        if (!(cancel instanceof HTMLButtonElement)) {
          throw new Error("Expected add folder cancel button");
        }

        const inputEl = input;
        const nameBinding = model(inputEl, name, { reactive: true });

        /**
         * @param {boolean} nextOpen
         * @returns {void}
         */
        function setOpen(nextOpen) {
          open(nextOpen);
          if (nextOpen) {
            queueMicrotask(() => inputEl.focus());
          } else {
            name("");
            errorMessage("");
          }
        }

        async function submitForm() {
          if (busy()) {
            return;
          }

          const nextName = name().trim();
          if (!nextName) {
            errorMessage("Folder name is required");
            inputEl.focus();
            return;
          }

          errorMessage("");
          busy(true);

          try {
            const folderId = await AddFolder(options.getParentFolderId(), nextName);
            await treeState.actions.refresh();
            if (folderId) {
              treeState.actions.selectSingle(folderId);
            }
            uiState.actions.showToast("Folder created", "success");
            setOpen(false);
            options.onAdded?.();
          } catch (caughtError) {
            errorMessage(getErrorMessage(caughtError, "Failed to create folder"));
          } finally {
            busy(false);
          }
        }

        function handleTriggerClick() {
          if (open()) {
            setOpen(false);
            return;
          }
          setOpen(true);
        }

        function handleCancelClick() {
          setOpen(false);
        }

        function handleSubmitClick() {
          void submitForm();
        }

        /** @param {KeyboardEvent} event */
        function handleInputKeydown(event) {
          if (event.key === "Enter") {
            event.preventDefault();
            void submitForm();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }

        trigger.addEventListener("click", handleTriggerClick);
        submit.addEventListener("click", handleSubmitClick);
        cancel.addEventListener("click", handleCancelClick);
        inputEl.addEventListener("keydown", handleInputKeydown);

        cleanup.add(
          nameBinding.cleanup,
          effect(() => {
            const available = options.isAvailable
              ? options.isAvailable()
              : Boolean(appState.currentFilePath());
            trigger.disabled = !available;
            if (!available) {
              setOpen(false);
            }
          }),
          fx(panel, (currentPanel) => {
            currentPanel.hidden = !open();
          }),
          fx(error, (currentError) => {
            const message = errorMessage();
            currentError.hidden = message.length === 0;
            currentError.textContent = message;
          }),
          fx(submit, (currentSubmit) => {
            currentSubmit.disabled = busy();
          }),
          () => trigger.removeEventListener("click", handleTriggerClick),
          () => submit.removeEventListener("click", handleSubmitClick),
          () => cancel.removeEventListener("click", handleCancelClick),
          () => inputEl.removeEventListener("keydown", handleInputKeydown),
        );
      },
      onUnmount() {
        cleanup.run();
      },
    })
  );

  return renderAddFolderForm`
    <div class="add-folder-launcher">
      <button
        type="button"
        class="${options.triggerClassName ?? "btn btn-secondary btn-sm"}"
        data-ref="trigger"
        ${options.triggerKeyboardAction ? `data-keyboard-action="${options.triggerKeyboardAction}"` : ""}
        ${options.triggerAriaLabel ? `aria-label="${options.triggerAriaLabel}"` : ""}
        ${options.triggerTitle ? `title="${options.triggerTitle}"` : ""}
      >
        ${options.triggerIconClassName
          ? `<span class="${options.triggerIconClassName}" aria-hidden="true"></span>`
          : options.triggerLabel}
      </button>
      <div class="add-folder-panel" hidden data-ref="panel">
        <p class="label">${options.formTitle ?? "Create folder"}</p>
        <div class="field">
          <input
            type="text"
            class="input"
            placeholder="Folder name"
            data-keyboard-action="add-folder-name"
            data-ref="input"
          />
          <p class="error-text" hidden data-ref="error"></p>
        </div>
        <div class="detail-inline-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-ref="submit">
            ${options.submitLabel ?? "Add Folder"}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-ref="cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
}
