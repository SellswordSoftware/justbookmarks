// @ts-check

import { effect, mount, template } from "../../shared/runtime/naf.js";
import { appState } from "../../shared/state/app-state.js";
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
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createTitlebarBrandComponent() {
  const renderBrand = /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (template);

  return renderBrand`
    <div class="titlebar__brand">
      <h1 class="titlebar__title">JustBookmarks</h1>
      <p id="titlebar-meta" class="titlebar__meta">Vanilla frontend shell active</p>
    </div>
  `;
}

/**
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createTitlebarWindowControlsComponent() {
  const renderControls = /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (
    template({
      onMount(_el, _host, ctx) {
        const { refs, cleanup } = ctx;
        const minimizeButton = refs.minimizeButton;
        const maximizeButton = refs.maximizeButton;
        const closeButton = refs.closeButton;

        if (!(minimizeButton instanceof HTMLButtonElement)) {
          throw new Error("Expected minimize button");
        }
        if (!(maximizeButton instanceof HTMLButtonElement)) {
          throw new Error("Expected maximize button");
        }
        if (!(closeButton instanceof HTMLButtonElement)) {
          throw new Error("Expected close button");
        }

        const handleMaximiseClick = () => {
          void toggleMaximiseWindow();
        };
        const handleFocus = () => {
          void appState.window.sync();
        };

        minimizeButton.addEventListener("click", minimiseWindow);
        maximizeButton.addEventListener("click", handleMaximiseClick);
        closeButton.addEventListener("click", closeWindow);
        window.addEventListener("focus", handleFocus);

        cleanup.add(
          () => minimizeButton.removeEventListener("click", minimiseWindow),
          () => maximizeButton.removeEventListener("click", handleMaximiseClick),
          () => closeButton.removeEventListener("click", closeWindow),
          () => window.removeEventListener("focus", handleFocus),
          effect(() => {
            const hasRuntime = appState.hasWailsRuntime();
            const maximised = appState.isMaximised();

            minimizeButton.disabled = !hasRuntime;
            maximizeButton.disabled = !hasRuntime;
            closeButton.disabled = !hasRuntime;

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

  return renderControls`
    <div class="titlebar__window-controls" data-wails-no-drag data-ref="windowControls">
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
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createTitlebarComponent() {
  const brand = createTitlebarBrandComponent();
  const controls = createTitlebarWindowControlsComponent();
  const renderTitlebar = /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (
    template({
      onMount(_el, host, ctx) {
        const { cleanup } = ctx;
        /** @param {Event} event */
        const handleDoubleClick = (event) => {
          const target = event.target;
          if (target instanceof HTMLElement && target.closest("[data-wails-no-drag]")) {
            return;
          }
          void toggleMaximiseWindow();
        };

        host.addEventListener("dblclick", handleDoubleClick);
        cleanup.add(() => host.removeEventListener("dblclick", handleDoubleClick));
      },
    })
  );

  return renderTitlebar`
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
  const titlebar = root.querySelector("#titlebar");
  if (!(titlebar instanceof HTMLElement)) {
    throw new Error("Expected #titlebar element");
  }

  return { titlebar };
}
