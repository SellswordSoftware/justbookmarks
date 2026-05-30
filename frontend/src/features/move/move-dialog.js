// @ts-check

import { MoveNode, MoveNodes } from "../../shared/api/api.js";
import { getErrorMessage } from "../../shared/infra/errors.js";
import { trapFocusInContainer } from "../../shared/infra/focus.js";
import {
  cleanupCollector,
  effect,
  list,
  mount,
  template,
} from "../../shared/runtime/naf.js";
import { moveDialogState } from "./move-dialog-state.js";
import { treeState } from "../tree/state/tree-state.js";
import { uiState } from "../../shared/state/ui-state.js";

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

/** @type {string} */
const MOVE_OPTION_HTML = /*html*/ `
  <button type="button" class="move-dialog__option" role="option" data-keyboard-action="move-target">
    <span class="move-dialog__option-icon">📁</span>
    <span class="move-dialog__option-content">
      <span class="move-dialog__option-name"></span>
      <span class="move-dialog__option-path"></span>
    </span>
  </button>
`;

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
    uiState.actions.showToast(
      `Move failed: ${getErrorMessage(caughtError)}`,
      "error",
    );
  }

  moveDialogState.actions.closeMoveDialog();
}

/**
 * @param {{
 *   label: string,
 *   hasFolders: boolean,
 *   hasSelectedTarget: boolean
 * }} view
 * @param {(mounted: {
 *   backdrop: HTMLDivElement,
 *   dialog: HTMLDivElement,
 *   listbox: HTMLDivElement,
 *   cancelButton: HTMLButtonElement,
 *   confirmButton: HTMLButtonElement,
 * }) => void} onMountElements
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createMoveDialog(view, onMountElements) {
  const emptyStateHtml = view.hasFolders
    ? ""
    : /*html*/ '<div class="move-dialog__empty">No eligible folders</div>';

  const renderDialog =
    /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (
      template({
        onMount(_el, _parent, ctx) {
          const backdrop = ctx.refs.backdrop;
          const dialog = ctx.refs.dialog;
          const listbox = ctx.refs.listbox;
          const cancelButton = ctx.refs.cancelButton;
          const confirmButton = ctx.refs.confirmButton;

          if (!(backdrop instanceof HTMLDivElement)) {
            throw new Error("Expected move dialog backdrop");
          }
          if (!(dialog instanceof HTMLDivElement)) {
            throw new Error("Expected move dialog");
          }
          if (!(listbox instanceof HTMLDivElement)) {
            throw new Error("Expected move dialog listbox");
          }
          if (!(cancelButton instanceof HTMLButtonElement)) {
            throw new Error("Expected move cancel button");
          }
          if (!(confirmButton instanceof HTMLButtonElement)) {
            throw new Error("Expected move confirm button");
          }

          onMountElements({
            backdrop,
            dialog,
            listbox,
            cancelButton,
            confirmButton,
          });
        },
      })
    );

  return renderDialog /*html*/ `
    <div class="modal-backdrop" role="presentation" data-ref="backdrop">
      <div
        class="modal move-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        data-focus-zone="dialog"
        data-ref="dialog"
      >
        <div class="modal__header move-dialog__header">
          <div>
            <h3 class="shell-panel__title">Move "${view.label}"</h3>
            <p class="shell-panel__subtitle">Select a target folder</p>
          </div>
        </div>
        <div class="modal__body">
          <div class="move-dialog__list-shell">
            <div class="move-dialog__list-header">Folder Tree</div>
            <div
              class="move-dialog__listbox"
              role="listbox"
              aria-label="Target folder"
              data-ref="listbox"
            >
              ${emptyStateHtml}
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-keyboard-action="move-cancel"
            data-ref="cancelButton"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-keyboard-action="move-confirm"
            data-ref="confirmButton"
            ${view.hasSelectedTarget ? "" : "disabled"}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountMoveDialog(shell) {
  let cleanupRendered = () => {};

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

    /** @type {{
     *   backdrop: HTMLDivElement,
     *   dialog: HTMLDivElement,
     *   listbox: HTMLDivElement,
     *   cancelButton: HTMLButtonElement,
     *   confirmButton: HTMLButtonElement,
     * } | undefined} */
    let mounted;

    const component = createMoveDialog(
      {
        label: request?.label ?? "",
        hasFolders: folders.length > 0,
        hasSelectedTarget: Boolean(
          moveDialogState.selectors.getSelectedTarget(),
        ),
      },
      (elements) => {
        mounted = elements;
      },
    );

    mount(component, shell.container);

    if (!mounted) {
      throw new Error("Expected move dialog elements after mount");
    }

    const { backdrop, dialog, listbox, cancelButton, confirmButton } = mounted;

    const handleBackdropClick = () => {
      moveDialogState.actions.closeMoveDialog();
    };
    /** @param {MouseEvent} event */
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
          (folder) =>
            folder.id === moveDialogState.selectors.getSelectedTarget(),
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

      if (
        event.key === "Enter" &&
        moveDialogState.selectors.getSelectedTarget()
      ) {
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
          MOVE_OPTION_HTML,
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
              const selected =
                moveDialogState.selectors.getSelectedTarget() ===
                currentFolder.id;
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
      component.unmount?.();
      shell.container.replaceChildren();
    };
  });

  return {
    cleanup() {
      cleanupRendered();
      stop();
    },
  };
}
