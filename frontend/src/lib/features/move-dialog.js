// @ts-check

import { MoveNode, MoveNodes } from "../api.js";
import { getErrorMessage } from "../errors.js";
import { trapFocusInContainer } from "../focus.js";
import { cleanupCollector, effect, list } from "../naf-html.js";
import { moveDialogState } from "../state/move-dialog-state.js";
import { treeState } from "../state/tree/tree-state.js";
import { uiState } from "../state/ui-state.js";

/**
 * @typedef {import("../../types.js").MoveTarget} MoveTarget
 */

/**
 * @param {ParentNode} root
 * @returns {{ container: HTMLElement }}
 */
export function collectMoveDialogShell(root) {
  const container = root.querySelector("#move-dialog-container");
  if (!(container instanceof HTMLElement)) {
    throw new Error("Expected #move-dialog-container element");
  }

  return { container };
}

/** @returns {HTMLTemplateElement} */
function createMoveOptionTemplate() {
  const template = document.createElement("template");
  template.innerHTML = `
    <button type="button" class="move-dialog__option" role="option" data-keyboard-action="move-target">
      <span class="move-dialog__option-icon">📁</span>
      <span class="move-dialog__option-content">
        <span class="move-dialog__option-name"></span>
        <span class="move-dialog__option-path"></span>
      </span>
    </button>
  `;
  return template;
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountMoveDialog(shell) {
  let cleanupRendered = () => {};
  const optionTemplate = createMoveOptionTemplate();

  /**
   * @param {MoveTarget[]} folders
   * @param {string} selectedTarget
   * @returns {void}
   */
  function ensureSelectedTarget(folders, selectedTarget) {
    if (selectedTarget) {
      return;
    }
    if (folders[0]) {
      moveDialogState.actions.setSelectedTarget(folders[0].id);
    }
  }

  async function move() {
    const request = moveDialogState.selectors.getRequest();
    const targetId = moveDialogState.selectors.getSelectedTarget();
    if (!request || !targetId) {
      return;
    }

    try {
      if (request.nodeIds.length === 1) {
        await MoveNode(request.nodeIds[0], targetId, -1);
      } else {
        await MoveNodes(request.nodeIds, targetId);
      }
      uiState.actions.showToast("Moved successfully", "success");
      await treeState.actions.refresh();
    } catch (caughtError) {
      uiState.actions.showToast(`Move failed: ${getErrorMessage(caughtError)}`, "error");
    }

    moveDialogState.actions.closeMoveDialog();
  }

  const stop = effect(() => {
    cleanupRendered();
    cleanupRendered = () => {};

    shell.container.replaceChildren();

    if (!moveDialogState.selectors.isOpen()) {
      return;
    }

    const request = moveDialogState.selectors.getRequest();
    const folders = moveDialogState.selectors.getFolders();
    const selectedTarget = moveDialogState.selectors.getSelectedTarget();

    ensureSelectedTarget(folders, selectedTarget);

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "modal move-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    dialog.setAttribute("data-focus-zone", "dialog");

    const header = document.createElement("div");
    header.className = "modal__header move-dialog__header";

    const headingBlock = document.createElement("div");
    const heading = document.createElement("h3");
    heading.className = "shell-panel__title";
    heading.textContent = `Move "${request?.label ?? ""}"`;

    const subtitle = document.createElement("p");
    subtitle.className = "shell-panel__subtitle";
    subtitle.textContent = "Select a target folder";

    headingBlock.append(heading, subtitle);
    header.append(headingBlock);

    const body = document.createElement("div");
    body.className = "modal__body";

    const listShell = document.createElement("div");
    listShell.className = "move-dialog__list-shell";

    const listHeader = document.createElement("div");
    listHeader.className = "move-dialog__list-header";
    listHeader.textContent = "Folder Tree";

    const listbox = document.createElement("div");
    listbox.className = "move-dialog__listbox";
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-label", "Target folder");

    if (folders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "move-dialog__empty";
      empty.textContent = "No eligible folders";
      listbox.append(empty);
    }

    listShell.append(listHeader, listbox);
    body.append(listShell);

    const footer = document.createElement("div");
    footer.className = "modal__footer";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "btn btn-ghost btn-sm";
    cancelButton.textContent = "Cancel";
    cancelButton.setAttribute("data-keyboard-action", "move-cancel");

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "btn btn-primary btn-sm";
    confirmButton.textContent = "Move";
    confirmButton.setAttribute("data-keyboard-action", "move-confirm");
    confirmButton.disabled = !moveDialogState.selectors.getSelectedTarget();

    footer.append(cancelButton, confirmButton);
    dialog.append(header, body, footer);
    backdrop.append(dialog);
    shell.container.append(backdrop);

    const handleBackdropClick = () => {
      moveDialogState.actions.closeMoveDialog();
    };
    const handleDialogClick = (event) => {
      event.stopPropagation();
    };
    const handleCancelClick = () => {
      moveDialogState.actions.closeMoveDialog();
    };
    const handleConfirmClick = () => {
      void move();
    };
    /** @param {KeyboardEvent} event */
    const handleDialogKeydown = (event) => {
      if (trapFocusInContainer(event, dialog)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        moveDialogState.actions.closeMoveDialog();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextFolders = moveDialogState.selectors.getFolders();
        if (nextFolders.length === 0) {
          return;
        }

        const currentIndex = nextFolders.findIndex(
          (folder) => folder.id === moveDialogState.selectors.getSelectedTarget(),
        );
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(
          Math.max((currentIndex >= 0 ? currentIndex : 0) + delta, 0),
          nextFolders.length - 1,
        );
        const nextTarget = nextFolders[nextIndex];
        if (nextTarget) {
          moveDialogState.actions.setSelectedTarget(nextTarget.id);
        }
        return;
      }

      if (event.key === "Enter" && moveDialogState.selectors.getSelectedTarget()) {
        event.preventDefault();
        void move();
      }
    };

    const cleanup = cleanupCollector(
      () => backdrop.removeEventListener("click", handleBackdropClick),
      () => dialog.removeEventListener("click", handleDialogClick),
      () => dialog.removeEventListener("keydown", handleDialogKeydown),
      () => cancelButton.removeEventListener("click", handleCancelClick),
      () => confirmButton.removeEventListener("click", handleConfirmClick),
    );

    backdrop.addEventListener("click", handleBackdropClick);
    dialog.addEventListener("click", handleDialogClick);
    dialog.addEventListener("keydown", handleDialogKeydown);
    cancelButton.addEventListener("click", handleCancelClick);
    confirmButton.addEventListener("click", handleConfirmClick);

    if (folders.length > 0) {
      cleanup.add(
        list(
          listbox,
          optionTemplate,
          () => moveDialogState.selectors.getFolders(),
          (folder) => folder.id,
          (el, folder) => {
            if (!(el instanceof HTMLButtonElement)) {
              throw new Error("Move option template must render a button");
            }

            const name = el.querySelector(".move-dialog__option-name");
            const path = el.querySelector(".move-dialog__option-path");
            const handleOptionClick = () => {
              moveDialogState.actions.setSelectedTarget(folder().id);
            };

            el.addEventListener("click", handleOptionClick);

            const stopOptionEffect = effect(() => {
              const currentFolder = folder();
              const selected = moveDialogState.selectors.getSelectedTarget() === currentFolder.id;
              el.style.paddingLeft = `${currentFolder.depth * 18 + 12}px`;
              el.setAttribute("aria-selected", selected ? "true" : "false");
              el.classList.toggle("is-selected", selected);
              if (name instanceof HTMLElement) {
                name.textContent = currentFolder.name;
              }
              if (path instanceof HTMLElement) {
                path.textContent = currentFolder.pathLabel;
              }
            });

            return () => {
              stopOptionEffect();
              el.removeEventListener("click", handleOptionClick);
            };
          },
        ),
      );
    }

    queueMicrotask(() => {
      const firstTarget = listbox.querySelector(".move-dialog__option");
      if (firstTarget instanceof HTMLButtonElement) {
        firstTarget.focus();
        return;
      }
      cancelButton.focus();
    });

    cleanupRendered = () => {
      cleanup.run();
    };
  });

  return {
    cleanup() {
      cleanupRendered();
      stop();
    },
  };
}
