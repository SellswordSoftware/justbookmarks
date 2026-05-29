// @ts-check

import { trapFocusInContainer } from "../../shared/infra/focus.js";
import { effect } from "../../shared/runtime/naf-html.js";
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
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountKeyboardShortcutsDialog(shell) {
  let cleanupRendered = () => {};

  const stop = effect(() => {
    cleanupRendered();
    cleanupRendered = () => {};

    shell.container.replaceChildren();

    if (!appState.selectors.isKeyboardShortcutsOpen()) {
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "modal shortcuts-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "keyboard-shortcuts-title");
    dialog.setAttribute("data-focus-zone", "dialog");
    dialog.tabIndex = -1;

    const header = document.createElement("div");
    header.className = "modal__header shortcuts-dialog__header";

    const headingBlock = document.createElement("div");
    const heading = document.createElement("h2");
    heading.id = "keyboard-shortcuts-title";
    heading.className = "shortcuts-dialog__title";
    heading.textContent = "Keyboard Shortcuts";

    const subtitle = document.createElement("p");
    subtitle.className = "shortcuts-dialog__subtitle";
    subtitle.textContent = "Core commands for mouse-free bookmark management.";

    headingBlock.append(heading, subtitle);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "btn btn-ghost btn-sm";
    closeButton.textContent = "Close";
    closeButton.setAttribute("data-keyboard-action", "shortcuts-close");

    header.append(headingBlock, closeButton);

    const body = document.createElement("div");
    body.className = "modal__body shortcuts-dialog__body";

    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "shortcuts-dialog__section";

      const sectionHeader = document.createElement("div");
      sectionHeader.className = "shortcuts-dialog__section-header";

      const sectionTitle = document.createElement("h3");
      sectionTitle.className = "shortcuts-dialog__section-title";
      sectionTitle.textContent = group.title;
      sectionHeader.append(sectionTitle);

      const rows = document.createElement("div");
      rows.className = "shortcuts-dialog__rows";

      for (const item of group.items) {
        const row = document.createElement("div");
        row.className = "shortcuts-dialog__row";

        const key = document.createElement("kbd");
        key.className = "shortcuts-dialog__kbd";
        key.textContent = item.keys;

        const action = document.createElement("span");
        action.className = "shortcuts-dialog__action";
        action.textContent = item.action;

        row.append(key, action);
        rows.append(row);
      }

      section.append(sectionHeader, rows);
      body.append(section);
    }

    dialog.append(header, body);
    backdrop.append(dialog);
    shell.container.append(backdrop);

    const closeDialog = () => {
      appState.actions.closeKeyboardShortcuts();
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
  });

  return {
    cleanup() {
      cleanupRendered();
      stop();
    },
  };
}
