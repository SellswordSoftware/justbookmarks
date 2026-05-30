// @ts-check

import { effect, list } from "../../shared/runtime/naf.js";
import { uiState } from "../../shared/state/ui-state.js";

/** @typedef {import("../../types.js").ToastType} ToastType */

/**
 * @param {ParentNode} root
 * @returns {{ container: HTMLElement }}
 */
export function collectToastContainerShell(root) {
  const container = root.querySelector("#toast-container");

  if (!(container instanceof HTMLElement)) {
    throw new Error("Expected #toast-container element");
  }

  return { container };
}

/** @type {string} */
const TOAST_ROW_HTML = /*html*/ `
  <article class="placeholder-card" data-template="toast">
    <strong data-ref="label">Toast</strong>
    <span data-ref="meta">Toast binding target.</span>
  </article>
`;

/**
 * @param {ToastType} type
 * @returns {string}
 */
function getToastTypeClass(type) {
  switch (type) {
    case "success":
      return "alert-success";
    case "error":
      return "alert-error";
    case "warning":
      return "alert-warning";
    case "info":
    default:
      return "alert-info";
  }
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountToastContainer(shell) {
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  shell.container.append(stack);

  const stopList = list(
    stack,
    TOAST_ROW_HTML,
    () => uiState.selectors.getToasts(),
    (toast) => toast.id,
    (el, toast) => {
      if (!(el instanceof HTMLElement)) {
        throw new Error("Toast template must have a first element child");
      }

      const label = el.querySelector('[data-ref="label"]');
      const meta = el.querySelector('[data-ref="meta"]');

      return effect(() => {
        const currentToast = toast();
        el.className = `toast alert ${getToastTypeClass(currentToast.type)}`;
        el.setAttribute("role", "alert");

        if (label instanceof HTMLElement) {
          label.hidden = true;
        }
        if (meta instanceof HTMLElement) {
          meta.textContent = currentToast.message;
        }
      });
    },
  );

  const stopVisibility = effect(() => {
    stack.hidden = uiState.selectors.getToasts().length === 0;
  });

  return {
    cleanup() {
      stopVisibility();
      stopList();
      stack.remove();
    },
  };
}
