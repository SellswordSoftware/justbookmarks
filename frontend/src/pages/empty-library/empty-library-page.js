// @ts-check

import { appState } from "../../shared/state/app-state.js";
import { searchState } from "../../features/search/state/search-state.js";
import { treeState } from "../../features/tree/state/tree-state.js";
import {
  attr,
  cleanupCollector,
  effect,
  mount,
  template,
} from "../../shared/runtime/naf.js";
import {
  collectPageHost,
  showEmptyLibraryFrame,
  showLibraryFrame,
} from "../page-frame.js";

/**
 * @typedef {object} EmptyLibraryPageShell
 * @property {HTMLElement} root
 * @property {HTMLElement} titlebarMeta
 * @property {HTMLElement} appToolbar
 * @property {HTMLElement} mainContent
 * @property {HTMLElement} treePane
 * @property {HTMLElement} detailPane
 * @property {HTMLButtonElement} paneResizer
 */

/**
 * @typedef {object} EmptyLibraryPageActions
 * @property {() => Promise<void>} openFile
 * @property {() => Promise<void>} createFile
 */

/**
 * @param {HTMLButtonElement} button
 * @param {boolean} busy
 * @param {string} idleLabel
 * @param {string} busyLabel
 * @returns {void}
 */
function setButtonBusyState(button, busy, idleLabel, busyLabel) {
  button.textContent = busy ? busyLabel : idleLabel;
}

/**
 * @param {EmptyLibraryPageShell} shell
 * @param {EmptyLibraryPageActions} actions
 * @returns {Component<HTMLElement>}
 */
function createEmptyLibrarySplash(shell, actions) {
  const cleanup = cleanupCollector();
  const renderSplash =
    /** @type {TemplateTag} */ (
      template({
        root: ".empty-library-page",
        onMount(el, _parent, ctx) {
          if (!(el instanceof HTMLElement)) {
            throw new Error("Expected empty library page root");
          }

          const openButton = ctx.refs.openButton;
          const createButton = ctx.refs.createButton;
          if (!(openButton instanceof HTMLButtonElement)) {
            throw new Error("Expected empty library open button");
          }
          if (!(createButton instanceof HTMLButtonElement)) {
            throw new Error("Expected empty library create button");
          }

          const handleOpenClick = () => {
            void actions.openFile();
          };
          const handleCreateClick = () => {
            void actions.createFile();
          };

          openButton.addEventListener("click", handleOpenClick);
          createButton.addEventListener("click", handleCreateClick);

          cleanup.add(
            () => openButton.removeEventListener("click", handleOpenClick),
            () => createButton.removeEventListener("click", handleCreateClick),
            attr(openButton, "disabled", () => treeState.selectors.isLoading()),
            attr(createButton, "disabled", () => treeState.selectors.isLoading()),
            effect(() => {
              const treeError = treeState.selectors.getError();
              const loading = treeState.selectors.isLoading();
              const hasAttemptedLoad = appState.hasTriedLoad();

              shell.titlebarMeta.textContent = treeError
                ? treeError
                : loading
                  ? "Loading bookmark library..."
                  : hasAttemptedLoad
                    ? "No bookmark file is open"
                    : "Ready to open a bookmark library";

              setButtonBusyState(
                openButton,
                loading,
                "Open File",
                "Opening...",
              );
              setButtonBusyState(
                createButton,
                loading,
                "Create File",
                "Creating...",
              );
            }),
          );

          queueMicrotask(() => {
            openButton.focus();
          });
        },
        onUnmount() {
          cleanup.run();
        },
      })
    );

  return renderSplash /*html*/ `
    <section class="empty-library-page" aria-labelledby="empty-library-title">
      <div class="empty-library-page__crest" aria-hidden="true">JB</div>
      <p class="empty-library-page__eyebrow">Single-file bookmark library</p>
      <h2 id="empty-library-title" class="empty-library-page__title">
        Open your archive or start a fresh one.
      </h2>
      <p class="empty-library-page__copy">
        JustBookmarks keeps everything in a plain bookmarks HTML file, so your
        library stays portable, inspectable, and yours.
      </p>
      <div class="empty-library-page__actions">
        <button
          type="button"
          class="empty-library-page__open btn btn-primary empty-library-page__button"
          data-ref="openButton"
        >
          Open File
        </button>
        <button
          type="button"
          class="empty-library-page__create btn btn-ghost empty-library-page__button empty-library-page__button--secondary"
          data-ref="createButton"
        >
          Create File
        </button>
      </div>
      <p class="empty-library-page__hint">
        Shortcuts: Ctrl/Cmd+O to open, Ctrl/Cmd+N to create.
      </p>
    </section>
  `;
}

/**
 * @param {EmptyLibraryPageShell} shell
 * @param {EmptyLibraryPageActions} actions
 * @returns {{ cleanup: () => void }}
 */
export function mountEmptyLibraryPage(shell, actions) {
  searchState.actions.clearQuery();
  showEmptyLibraryFrame(shell);
  const pageHost = collectPageHost(shell.root);

  const splash = createEmptyLibrarySplash(shell, actions);
  mount(splash, pageHost);

  return {
    cleanup() {
      splash.unmount?.();
      pageHost.replaceChildren();
      showLibraryFrame(shell);
    },
  };
}
