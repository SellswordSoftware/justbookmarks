// @ts-check

import { attr, effect, listener, mount, requireElement, requireRef, template } from "../../shared/runtime/naf.js";
import { appState } from "../../shared/state/app-state.js";
import { saving } from "../../shared/state/save-state.js";
import {
  Quit,
  WindowMinimise,
  WindowToggleMaximise,
} from "../../../wailsjs/runtime/runtime.js";

/**
 * @typedef {object} TitlebarShell
 * @property {HTMLElement} titlebar
 */

/** @returns {void} */
function minimiseWindow() {
  if (!appState.hasWailsRuntime()) {
    return;
  }
  WindowMinimise();
}

/** @returns {Promise<void>} */
async function toggleMaximiseWindow() {
  if (!appState.hasWailsRuntime()) {
    return;
  }
  WindowToggleMaximise();
  await appState.window.sync();
}

/** @returns {void} */
function closeWindow() {
  if (!appState.hasWailsRuntime()) {
    return;
  }
  Quit();
}

/**
 * @returns {Component<HTMLElement>}
 */
function createTitlebarBrandComponent() {
  const renderBrand = /** @type {TemplateTag} */ (
    template({
      onMount(_el, _host, ctx) {
        const { cleanup } = ctx;
        cleanup.add(
          effect(() => {
            const isSaving = saving();
            const spinner = document.querySelector(".titlebar__save-spinner");
            if (spinner instanceof HTMLElement) {
              if (isSaving) {
                spinner.hidden = false;
                spinner.removeAttribute("aria-hidden");
              } else {
                spinner.hidden = true;
                spinner.setAttribute("aria-hidden", "true");
              }
            }
          }),
        );
      },
    })
  );

  return renderBrand /*html*/ `
    <div class="titlebar__brand">
      <div class="titlebar__title-row">
        <h1 class="titlebar__title">JustBookmarks</h1>
        <span
          class="spinner spinner-sm titlebar__save-spinner"
          hidden
          aria-hidden="true"
        ></span>
      </div>
      <p id="titlebar-meta" class="titlebar__meta"></p>
    </div>
  `;
}

/**
 * @returns {Component<HTMLElement>}
 */
function createTitlebarWindowControlsComponent() {
  const renderControls = /** @type {TemplateTag} */ (
    template({
      onMount(_el, _host, ctx) {
        const { refs, cleanup } = ctx;
        const themeToggleButton = /** @type {HTMLButtonElement} */ (requireRef(refs, "themeToggleButton"));
        const minimizeButton = /** @type {HTMLButtonElement} */ (requireRef(refs, "minimizeButton"));
        const maximizeButton = /** @type {HTMLButtonElement} */ (requireRef(refs, "maximizeButton"));
        const closeButton = /** @type {HTMLButtonElement} */ (requireRef(refs, "closeButton"));

        const handleMaximiseClick = () => {
          void toggleMaximiseWindow();
        };
        const handleFocus = () => {
          void appState.window.sync();
        };

        themeToggleButton.addEventListener("click", () => {
          const current = appState.window.theme();
          appState.window.setTheme(current === "light" ? "dark" : "light");
          themeToggleButton.innerHTML = current === "light" ? "🌞" : "🌙";
        });
        themeToggleButton.innerHTML = appState.window.theme() === "light" ? "🌙" : "🌞";

        cleanup.add(
          listener(minimizeButton, "click", minimiseWindow),
          listener(maximizeButton, "click", handleMaximiseClick),
          listener(closeButton, "click", closeWindow),
          listener(window, "focus", handleFocus),
          attr(minimizeButton, "disabled", () => !appState.hasWailsRuntime()),
          attr(maximizeButton, "disabled", () => !appState.hasWailsRuntime()),
          attr(closeButton, "disabled", () => !appState.hasWailsRuntime()),
          effect(() => {
            const maximised = appState.isMaximised();

            maximizeButton.textContent = maximised ? "❐" : "□";
            maximizeButton.setAttribute(
              "aria-label",
              maximised ? "Restore window" : "Maximize window",
            );
            maximizeButton.title = maximised ? "Restore" : "Maximize";
          }),
        );

        void appState.window.sync();
      },
    })
  );

  return renderControls/*html*/`
    <div class="titlebar__window-controls" data-wails-no-drag data-ref="windowControls">
      <button
        id="theme-toggle"
        data-ref="themeToggleButton"
        class="btn btn-ghost btn-sm btn-square"
      >
        🌙
      </button>
      <button
        id="window-minimize"
        data-ref="minimizeButton"
        class="btn btn-ghost btn-sm btn-square titlebar__window-button"
        type="button"
        aria-label="Minimize window"
      >
        &#9472;
      </button>
      <button
        id="window-maximize"
        data-ref="maximizeButton"
        class="btn btn-ghost btn-sm btn-square titlebar__window-button"
        type="button"
        aria-label="Toggle maximize"
      >
        &#9633;
      </button>
      <button
        id="window-close"
        data-ref="closeButton"
        class="btn btn-ghost btn-sm btn-square titlebar__window-button titlebar__window-button--close"
        type="button"
        aria-label="Close window"
      >
        &#10005;
      </button>
    </div>
  `;
}

/**
 * @returns {Component<HTMLElement>}
 */
function createTitlebarComponent() {
  const brand = createTitlebarBrandComponent();
  const controls = createTitlebarWindowControlsComponent();
  const renderTitlebar = /** @type {TemplateTag} */ (
    template({
      onMount(_el, host, ctx) {
        const { cleanup } = ctx;
        /** @param {Event} event */
        const handleDoubleClick = (event) => {
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.closest("[data-wails-no-drag]")
          ) {
            return;
          }
          void toggleMaximiseWindow();
        };

        cleanup.add(
          listener(host, "dblclick", handleDoubleClick),
        );
      },
    })
  );

  return renderTitlebar/*html*/`
    ${brand}
    ${controls}
  `;
}

/**
 * @param {TitlebarShell} shell
 * @returns {() => void}
 */
export function mountTitlebar(shell) {
  const component = createTitlebarComponent();
  mount(component, shell.titlebar);

  return () => {
    component.unmount?.();
    shell.titlebar.replaceChildren();
  };
}

/**
 * @param {ParentNode} root
 * @returns {TitlebarShell}
 */
export function collectTitlebarShell(root) {
  return { titlebar: requireElement(root, "#titlebar", "titlebar") };
}
