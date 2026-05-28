// @ts-check

import { effect, list } from "../naf-html.js";
import { uiState } from "../state/ui-state.js";

/** @typedef {import("../../types.js").ToastType} ToastType */

/**
 * @param {ParentNode} root
 * @returns {{ container: HTMLElement, template: HTMLTemplateElement }}
 */
export function collectToastContainerShell(root) {
  const container = root.querySelector("#toast-container");
  const template = root.querySelector("#toast-template");

  if (!(container instanceof HTMLElement)) {
    throw new Error("Expected #toast-container element");
  }
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error("Expected #toast-template element");
  }

  return { container, template };
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
 * @param {{ container: HTMLElement, template: HTMLTemplateElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountToastContainer(shell) {
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  shell.container.append(stack);

  const stopList = list(
    stack,
    shell.template,
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
    },
  };
}
