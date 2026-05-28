// @ts-check

import { AddFolder } from "../api.js";
import { cleanupCollector, effect, fx, model, signal } from "../naf-html.js";
import { getErrorMessage } from "../errors.js";
import { appState } from "../state/app-state.js";
import { treeState } from "../state/tree-state.js";
import { uiState } from "../state/ui-state.js";

/**
 * @typedef {object} AddFolderFormOptions
 * @property {string} triggerLabel
 * @property {string=} triggerClassName
 * @property {string=} formTitle
 * @property {string=} submitLabel
 * @property {string=} triggerKeyboardAction
 * @property {() => string} getParentFolderId
 * @property {() => boolean=} isAvailable
 * @property {(() => void)=} onAdded
 */

/**
 * @param {AddFolderFormOptions} options
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function createAddFolderForm(options) {
  const wrapper = document.createElement("div");
  wrapper.className = "add-folder-launcher";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = options.triggerClassName ?? "btn btn-secondary btn-sm";
  trigger.textContent = options.triggerLabel;
  if (options.triggerKeyboardAction) {
    trigger.setAttribute("data-keyboard-action", options.triggerKeyboardAction);
  }

  const panel = document.createElement("div");
  panel.className = "add-folder-panel";
  panel.hidden = true;

  const title = document.createElement("p");
  title.className = "label";
  title.textContent = options.formTitle ?? "Create folder";

  const field = document.createElement("div");
  field.className = "field";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input";
  input.placeholder = "Folder name";
  input.setAttribute("data-keyboard-action", "add-folder-name");

  const error = document.createElement("p");
  error.className = "error-text";
  error.hidden = true;

  const actions = document.createElement("div");
  actions.className = "detail-inline-actions";

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "btn btn-secondary btn-sm";
  submit.textContent = options.submitLabel ?? "Add Folder";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost btn-sm";
  cancel.textContent = "Cancel";

  field.append(input, error);
  actions.append(submit, cancel);
  panel.append(title, field, actions);
  wrapper.append(trigger, panel);

  const open = signal(false);
  const busy = signal(false);
  const name = signal("");
  const errorMessage = signal("");

  const nameBinding = model(input, name, { reactive: true });
  const cleanup = cleanupCollector(nameBinding.cleanup);

  /**
   * @param {boolean} nextOpen
   * @returns {void}
   */
  function setOpen(nextOpen) {
    open(nextOpen);
    if (nextOpen) {
      queueMicrotask(() => input.focus());
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
      input.focus();
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
  input.addEventListener("keydown", handleInputKeydown);

  const stop = effect(() => {
    const available = options.isAvailable ? options.isAvailable() : Boolean(appState.selectors.getCurrentFilePath());
    trigger.disabled = !available;
    if (!available) {
      setOpen(false);
    }
  });
  cleanup.add(
    stop,
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
    () => input.removeEventListener("keydown", handleInputKeydown),
  );

  return {
    element: wrapper,
    cleanup() {
      cleanup.run();
    },
  };
}
