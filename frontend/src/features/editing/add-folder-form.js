// @ts-check

import { AddFolder } from "../../shared/api/api.js";
import {
  cleanupCollector,
  effect,
  fx,
  model,
  raw,
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
 * @returns {Component<HTMLElement>}
 */
export function createAddFolderForm(options) {
  const open = signal(false);
  const busy = signal(false);
  const name = signal("");
  const errorMessage = signal("");
  const cleanup = cleanupCollector();

  const renderAddFolderForm = /** @type {TemplateTag} */ (
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
        const panelEl = panel;
        const detailPaneContent = panelEl.closest(".detail-pane__content");
        const treePane = panelEl.closest(".tree-pane");
        let isPositionListenerAttached = false;
        const nameBinding = model(inputEl, name, { reactive: true });

        /**
         * @param {number} value
         * @param {number} min
         * @param {number} max
         * @returns {number}
         */
        function clamp(value, min, max) {
          return Math.min(Math.max(value, min), max);
        }

        function clearPanelPlacement() {
          panelEl.style.removeProperty("left");
          panelEl.style.removeProperty("right");
          panelEl.style.removeProperty("top");
          panelEl.style.removeProperty("bottom");
        }

        function positionPanel() {
          const inDetailActions = Boolean(panelEl.closest(".detail-inline-actions"));
          const inTreeActions = Boolean(panelEl.closest(".tree-pane__actions"));
          const boundaryContainer = inDetailActions
            ? detailPaneContent
            : inTreeActions
              ? treePane
              : null;
          if (!(boundaryContainer instanceof HTMLElement)) {
            return;
          }
          const launcher = panelEl.parentElement;
          if (!(launcher instanceof HTMLElement)) {
            return;
          }

          // Start from default "below + right aligned" placement.
          panelEl.style.left = "0px";
          panelEl.style.right = "auto";
          panelEl.style.top = "calc(100% + 0.4rem)";
          panelEl.style.bottom = "auto";

          const margin = 8;
          const gap = 6;
          const containerRect = boundaryContainer.getBoundingClientRect();
          const launcherRect = launcher.getBoundingClientRect();
          const panelRect = panelEl.getBoundingClientRect();
          if (panelRect.width === 0 || panelRect.height === 0) {
            return;
          }

          const defaultLeft = launcherRect.width - panelRect.width;
          const minLeft = containerRect.left + margin - launcherRect.left;
          const maxLeft = containerRect.right - margin - panelRect.width - launcherRect.left;
          const nextLeft = minLeft <= maxLeft
            ? clamp(defaultLeft, minLeft, maxLeft)
            : minLeft;
          panelEl.style.left = `${Math.round(nextLeft)}px`;

          const spaceBelow = containerRect.bottom - launcherRect.bottom - margin;
          const spaceAbove = launcherRect.top - containerRect.top - margin;
          const shouldOpenUp =
            spaceBelow < panelRect.height + gap && spaceAbove > spaceBelow;

          if (shouldOpenUp) {
            panelEl.style.top = "auto";
            panelEl.style.bottom = `${Math.round(launcherRect.height + gap)}px`;
          }
        }

        function attachPositionListeners() {
          if (isPositionListenerAttached) {
            return;
          }
          if (detailPaneContent instanceof HTMLElement && panelEl.closest(".detail-inline-actions")) {
            detailPaneContent.addEventListener("scroll", positionPanel);
          }
          window.addEventListener("resize", positionPanel);
          isPositionListenerAttached = true;
        }

        function detachPositionListeners() {
          if (!isPositionListenerAttached) {
            return;
          }
          if (detailPaneContent instanceof HTMLElement) {
            detailPaneContent.removeEventListener("scroll", positionPanel);
          }
          window.removeEventListener("resize", positionPanel);
          isPositionListenerAttached = false;
        }

        /**
         * @param {boolean} nextOpen
         * @returns {void}
         */
        function setOpen(nextOpen) {
          open(nextOpen);
          if (nextOpen) {
            attachPositionListeners();
            queueMicrotask(() => {
              positionPanel();
              inputEl.focus();
            });
          } else {
            detachPositionListeners();
            clearPanelPlacement();
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
            const createdFolder = await AddFolder(options.getParentFolderId(), nextName);
            const inserted = treeState.actions.insertFlatNode(
              createdFolder.parentId,
              createdFolder,
            );
            if (!inserted) {
              await treeState.actions.refresh();
            }
            if (treeState.selectors.getNode(createdFolder.id)) {
              treeState.actions.selectSingle(createdFolder.id);
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
          () => detachPositionListeners(),
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
        ${raw(options.triggerKeyboardAction ? `data-keyboard-action="${options.triggerKeyboardAction}"` : "")}
        ${raw(options.triggerAriaLabel ? `aria-label="${options.triggerAriaLabel}"` : "")}
        ${raw(options.triggerTitle ? `title="${options.triggerTitle}"` : "")}
      >
        ${raw(options.triggerIconClassName
          ? `<span class="${options.triggerIconClassName}" aria-hidden="true"></span>`
          : options.triggerLabel)}
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
