// @ts-check

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
  showEmptyLibraryFrame,
  showLibraryFrame,
} from "../page-frame.js";

/**
 * @typedef {object} EmptyLibraryPageShell
 * @property {HTMLElement} root
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
 * @param {EmptyLibraryPageActions} actions
 * @returns {Component<HTMLElement>}
 */
function createEmptyLibrarySplash(actions) {
  /** @type {TemplateTag} */
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

  const cleanup = cleanupCollector();

  return renderSplash /*html*/ `
    <section class="empty-library-page" aria-labelledby="empty-library-title">
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
          class="btn btn-primary"
          data-ref="openButton"
        >
          Open File
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          data-ref="createButton"
        >
          Create File
        </button>
      </div>
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

  const emptyLibraryHost =
    /** @type {HTMLElement|null} */ (document.getElementById("empty-library-host"));
  if (!(emptyLibraryHost instanceof HTMLElement)) {
    throw new Error("Expected #empty-library-host element");
  }

  const splash = createEmptyLibrarySplash(actions);
  mount(splash, emptyLibraryHost);

  const titlebarMeta =
    /** @type {HTMLElement|null} */ (document.getElementById("titlebar-meta"));
  if (!(titlebarMeta instanceof HTMLElement)) {
    throw new Error("Expected #titlebar-meta element");
  }

  const stopEffect = effect(() => {
    const treeError = treeState.selectors.getError();
    const loading = treeState.selectors.isLoading();

    titlebarMeta.textContent = treeError
      ? treeError
      : loading
        ? "Loading bookmark library..."
        : "No bookmark file is open";
  });

  return {
    cleanup() {
      stopEffect();
      titlebarMeta.textContent = "";
      splash.unmount?.();
      emptyLibraryHost.replaceChildren();
      showLibraryFrame(shell);
    },
  };
}
