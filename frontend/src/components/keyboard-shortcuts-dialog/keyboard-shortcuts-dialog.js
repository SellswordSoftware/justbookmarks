// @ts-check

import { trapFocusInContainer } from "../../shared/infra/focus.js";
import { effect, mount, template } from "../../shared/runtime/naf.js";
import { appState } from "../../shared/state/app-state.js";

const groups = [
  {
    title: "Global",
    items: [
      { keys: "Ctrl/Cmd+O", action: "Open file" },
      { keys: "Ctrl/Cmd+N", action: "Create file" },
      { keys: "Ctrl/Cmd+Shift+I", action: "Import / merge" },
      { keys: "Ctrl/Cmd+F or /", action: "Focus search" },
      { keys: "F6", action: "Cycle focus zones" },
      { keys: "Ctrl/Cmd+Z", action: "Undo" },
      { keys: "Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z", action: "Redo" },
      { keys: "? or F1", action: "Show keyboard help" },
    ],
  },
  {
    title: "Tree",
    items: [
      { keys: "Arrow keys", action: "Navigate tree or search results" },
      { keys: "Home / End", action: "Jump first or last item" },
      { keys: "PageUp / PageDown", action: "Jump by larger step" },
      { keys: "Enter", action: "Open detail panel for selection" },
      { keys: "Space", action: "Toggle folder expand/collapse" },
    ],
  },
  {
    title: "Selection",
    items: [
      { keys: "Shift+Up / Shift+Down", action: "Extend selection range" },
      { keys: "Ctrl/Cmd+Space", action: "Toggle current item in selection" },
      { keys: "Ctrl/Cmd+A", action: "Select all siblings" },
      { keys: "Ctrl/Cmd+Shift+A", action: "Collapse to primary selection" },
    ],
  },
  {
    title: "Actions",
    items: [
      { keys: "A", action: "Add bookmark" },
      { keys: "Shift+A", action: "Add folder" },
      { keys: "E", action: "Edit item" },
      { keys: "F2", action: "Rename item" },
      { keys: "O", action: "Open bookmark" },
      { keys: "M", action: "Move selection" },
      { keys: "Delete / Backspace", action: "Delete selection" },
      { keys: "Ctrl/Cmd+Shift+F", action: "Fetch favicon(s)" },
      { keys: "Ctrl/Cmd+Shift+T", action: "Refresh title(s)" },
    ],
  },
  {
    title: "Other Features",
    items: [
      { keys: "Ctrl/Cmd+Click", action: "Add or remove an item from multi-selection" },
      { keys: "Shift+Click", action: "Select a range within the current sibling group" },
      { keys: "Drag and Drop", action: "Reorder items or move them into folders" },
      { keys: "Search + Enter", action: "Jump from search results into the detail panel" },
      { keys: "Search + Ctrl/Cmd+Enter", action: "Open the selected search result directly" },
    ],
  },
];

/**
 * @param {ParentNode} root
 * @returns {{ container: HTMLElement }}
 */
export function collectKeyboardShortcutsDialogShell(root) {
  const container = root.querySelector("#keyboard-shortcuts-dialog-container");
  if (!(container instanceof HTMLElement)) {
    throw new Error("Expected #keyboard-shortcuts-dialog-container element");
  }

  return { container };
}

/**
 * @param {{ title: string, items: Array<{ keys: string, action: string }> }} group
 * @returns {string}
 */
function renderGroup(group) {
  const itemsHtml = group.items
    .map(
      (item) => `
        <div class="shortcuts-dialog__row">
          <kbd class="shortcuts-dialog__kbd">${item.keys}</kbd>
          <span class="shortcuts-dialog__action">${item.action}</span>
        </div>
      `,
    )
    .join("");

  return `
    <section class="shortcuts-dialog__section">
      <div class="shortcuts-dialog__section-header">
        <h3 class="shortcuts-dialog__section-title">${group.title}</h3>
      </div>
      <div class="shortcuts-dialog__rows">${itemsHtml}</div>
    </section>
  `;
}

/**
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createKeyboardShortcutsDialog() {
  let cleanupRendered = () => {};
  const groupsHtml = groups.map(renderGroup).join("");
  const renderDialog = /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (
    template({
      onMount(_el, _parent, ctx) {
        const backdrop = ctx.refs.backdrop;
        const dialog = ctx.refs.dialog;
        const closeButton = ctx.refs.closeButton;

        if (!(backdrop instanceof HTMLDivElement)) {
          throw new Error("Expected shortcuts dialog backdrop");
        }
        if (!(dialog instanceof HTMLDivElement)) {
          throw new Error("Expected shortcuts dialog element");
        }
        if (!(closeButton instanceof HTMLButtonElement)) {
          throw new Error("Expected shortcuts dialog close button");
        }

        const closeDialog = () => {
          appState.keyboardShortcuts.close();
        };
        /** @param {MouseEvent} event */
        const handleBackdropClick = (event) => {
          if (event.target === backdrop) {
            closeDialog();
          }
        };
        /** @param {MouseEvent} event */
        const handleDialogClick = (event) => {
          event.stopPropagation();
        };
        const handleCloseClick = () => {
          closeDialog();
        };
        /** @param {KeyboardEvent} event */
        const handleDialogKeydown = (event) => {
          if (trapFocusInContainer(event, dialog)) {
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            closeDialog();
          }
        };

        backdrop.addEventListener("click", handleBackdropClick);
        dialog.addEventListener("click", handleDialogClick);
        dialog.addEventListener("keydown", handleDialogKeydown);
        closeButton.addEventListener("click", handleCloseClick);

        queueMicrotask(() => {
          closeButton.focus();
        });

        cleanupRendered = () => {
          backdrop.removeEventListener("click", handleBackdropClick);
          dialog.removeEventListener("click", handleDialogClick);
          dialog.removeEventListener("keydown", handleDialogKeydown);
          closeButton.removeEventListener("click", handleCloseClick);
        };
      },
      onUnmount() {
        cleanupRendered();
        cleanupRendered = () => {};
      },
    })
  );

  return renderDialog`
    <div class="modal-backdrop" role="presentation" data-ref="backdrop">
      <div
        class="modal shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        data-focus-zone="dialog"
        tabindex="-1"
        data-ref="dialog"
      >
        <div class="modal__header shortcuts-dialog__header">
          <div>
            <h2 id="keyboard-shortcuts-title" class="shortcuts-dialog__title">Keyboard Shortcuts</h2>
            <p class="shortcuts-dialog__subtitle">Core commands for mouse-free bookmark management.</p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-keyboard-action="shortcuts-close"
            data-ref="closeButton"
          >
            Close
          </button>
        </div>
        <div class="modal__body shortcuts-dialog__body">${groupsHtml}</div>
      </div>
    </div>
  `;
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountKeyboardShortcutsDialog(shell) {
  /** @type {(() => void) | undefined} */
  let cleanupRendered;

  const stop = effect(() => {
    cleanupRendered?.();
    cleanupRendered = undefined;
    shell.container.replaceChildren();

    if (!appState.keyboardShortcutsOpen()) {
      return;
    }

    const component = createKeyboardShortcutsDialog();
    mount(component, shell.container);

    cleanupRendered = () => {
      component.unmount?.();
      shell.container.replaceChildren();
    };
  });

  return {
    cleanup() {
      cleanupRendered?.();
      stop();
    },
  };
}
