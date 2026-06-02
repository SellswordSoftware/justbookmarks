// @ts-check

import { collectRowRefs, effect, list, mount, requireElement, template, when } from "../../shared/runtime/naf.js";
import { uiState } from "../../shared/state/ui-state.js";

/** @type {string} */
const INFO_SVG = /*html*/ `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="toast-icon">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
`;

/** @type {string} */
const SUCCESS_SVG = /*html*/ `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="toast-icon">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
`;

/** @type {string} */
const WARNING_SVG = /*html*/ `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="toast-icon">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
`;

/** @type {string} */
const ERROR_SVG = /*html*/ `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="toast-icon">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
`;

/** @type {string} */
const TOAST_ROW_HTML = /*html*/ `
  <article class="toast" data-template="toast">
    <div class="alert" data-ref="alert-wrapper">
      <span data-ref="icon"></span>
      <span data-ref="message"></span>
    </div>
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
 * @param {ToastType} type
 * @returns {string}
 */
function getToastIcon(type) {
  switch (type) {
    case "success":
      return SUCCESS_SVG;
    case "warning":
      return WARNING_SVG;
    case "error":
      return ERROR_SVG;
    default:
      return INFO_SVG;
  }
}

/**
 * @param {ParentNode} root
 * @returns {{ cleanup: () => void }}
 */
export function mountToastContainer(root) {
  const container = /** @type {HTMLElement} */ (requireElement(root, "#toast-container", "toast-container"));
  const renderShell = /** @type {TemplateTag} */ (template);

  const component = renderShell`
    ${when(
      () => uiState.selectors.getToasts().length > 0,
      () => createToastStack(container),
      () => createEmptyComponent(),
    )}
  `;

  mount(component, container);

  return {
    cleanup() {
      component.unmount?.();
    },
  };
}

/** @returns {Component} */
function createEmptyComponent() {
  return {
    html: '',
    refs: {},
    mount() {},
    unmount() {},
  };
}

/**
 * @param {HTMLElement} container
 * @returns {Component}
 */
function createToastStack(container) {
  const stack = document.createElement("div");
  stack.className = "toast-stack";

  /** @type {Component} */
  const wrapper = {
    html: '',
    refs: {},
    mount(parent) {
      parent.appendChild(stack);

      const stopList = list(
        stack,
        TOAST_ROW_HTML,
        () => uiState.selectors.getToasts(),
        (toast) => toast.id,
        (el, toast) => {
          if (!(el instanceof HTMLElement)) {
            throw new Error("Toast template must have a first element child");
          }

          const refs = collectRowRefs(el);
          const alertWrapper = /** @type {HTMLElement} */ (refs["alert-wrapper"]);
          const icon = /** @type {HTMLElement} */ (refs.icon);
          const message = /** @type {HTMLElement} */ (refs.message);

          return effect(() => {
            const currentToast = toast();
            el.setAttribute("role", "alert");

            alertWrapper.className = `alert ${getToastTypeClass(currentToast.type)}`;
            icon.innerHTML = getToastIcon(currentToast.type);
            message.textContent = currentToast.message;
          });
        },
      );

      wrapper.unmount = () => {
        stopList();
        stack.remove();
      };
    },
    unmount() {
      stack.remove();
    },
  };

  return wrapper;
}
