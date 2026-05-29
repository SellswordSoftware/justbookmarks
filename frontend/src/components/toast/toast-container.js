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

/**
 * @returns {HTMLTemplateElement}
 */
function createToastTemplate() {
  const template = document.createElement("template");
  template.innerHTML = `
    <article class="placeholder-card" data-template="toast">
      <strong data-part="label">Toast</strong>
      <span data-part="meta">Toast binding target.</span>
    </article>
  `;
  return template;
}

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
  const template = createToastTemplate();
  stack.className = "toast-stack";
  shell.container.append(stack);

  const stopList = list(
    stack,
    template,
    () => uiState.selectors.getToasts(),
    (toast) => toast.id,
    (el, toast) => {
      if (!(el instanceof HTMLElement)) {
        throw new Error("Toast template must have a first element child");
      }

      const label = el.querySelector('[data-part="label"]');
      const meta = el.querySelector('[data-part="meta"]');

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
