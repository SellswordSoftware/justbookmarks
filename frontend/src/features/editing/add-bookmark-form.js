// @ts-check

import {
  AddBookmark,
  FetchFavicon,
  FetchPageTitle,
} from "../../shared/api/api.js";
import {
  cleanupCollector,
  effect,
  fx,
  model,
  signal,
  template,
} from "../../shared/runtime/naf.js";
import { getErrorMessage } from "../../shared/infra/errors.js";
import { appState } from "../../shared/state/app-state.js";
import { treeState } from "../tree/state/tree-state.js";
import { uiState } from "../../shared/state/ui-state.js";

/**
 * @typedef {object} AddBookmarkFormOptions
 * @property {string} triggerLabel
 * @property {string=} triggerClassName
 * @property {string=} formTitle
 * @property {string=} submitLabel
 * @property {string=} triggerKeyboardAction
 * @property {string=} triggerAriaLabel
 * @property {string=} triggerTitle
 * @property {string=} triggerIconClassName
 * @property {() => string} getParentFolderId
 * @property {() => boolean=} isAvailable
 * @property {(() => void)=} onAdded
 */

/**
 * @param {string} value
 * @returns {boolean}
 */
function canFetchMetadata(value) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {AddBookmarkFormOptions} options
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
export function createAddBookmarkForm(options) {
  const open = signal(false);
  const busy = signal(false);
  const loadingState = signal(false);
  const url = signal("");
  const titleValue = signal("");
  const errorMessage = signal("");
  let icon = "";
  let lastAutoTitle = "";
  let lastAutoIcon = "";
  let fetchSequence = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let fetchTimer = null;
  const cleanup = cleanupCollector();

  function clearScheduledFetch() {
    if (fetchTimer !== null) {
      clearTimeout(fetchTimer);
      fetchTimer = null;
    }
  }

  /**
   * @param {boolean} fetching
   * @returns {void}
   */
  function syncLoading(fetching) {
    loadingState(fetching);
  }

  function resetForm() {
    clearScheduledFetch();
    fetchSequence += 1;
    syncLoading(false);
    url("");
    titleValue("");
    icon = "";
    lastAutoTitle = "";
    lastAutoIcon = "";
    errorMessage("");
  }

  const renderAddBookmarkForm =
    /** @type {(strings: TemplateStringsArray, ...values: Array<string | number | boolean | null | undefined | import("../../shared/runtime/naf.js").Component>) => import("../../shared/runtime/naf.js").Component<HTMLElement>} */ (
      template({
        root: ".add-bookmark-launcher",
        onMount(_el, _parent, ctx) {
          const trigger = ctx.refs.trigger;
          const panel = ctx.refs.panel;
          const urlInput = ctx.refs.urlInput;
          const titleInput = ctx.refs.titleInput;
          const loading = ctx.refs.loading;
          const error = ctx.refs.error;
          const submit = ctx.refs.submit;
          const cancel = ctx.refs.cancel;

          if (!(trigger instanceof HTMLButtonElement)) {
            throw new Error("Expected add bookmark trigger button");
          }
          if (!(panel instanceof HTMLElement)) {
            throw new Error("Expected add bookmark panel");
          }
          if (!(urlInput instanceof HTMLInputElement)) {
            throw new Error("Expected add bookmark URL input");
          }
          if (!(titleInput instanceof HTMLInputElement)) {
            throw new Error("Expected add bookmark title input");
          }
          if (!(loading instanceof HTMLElement)) {
            throw new Error("Expected add bookmark loading element");
          }
          if (!(error instanceof HTMLElement)) {
            throw new Error("Expected add bookmark error element");
          }
          if (!(submit instanceof HTMLButtonElement)) {
            throw new Error("Expected add bookmark submit button");
          }
          if (!(cancel instanceof HTMLButtonElement)) {
            throw new Error("Expected add bookmark cancel button");
          }

          const urlInputEl = urlInput;
          const titleInputEl = titleInput;
          const urlBinding = model(urlInputEl, url, { reactive: true });
          const titleBinding = model(titleInputEl, titleValue, {
            reactive: true,
          });

          /**
           * @param {boolean} nextOpen
           * @returns {void}
           */
          function setOpen(nextOpen) {
            open(nextOpen);
            if (nextOpen) {
              queueMicrotask(() => urlInputEl.focus());
              return;
            }
            resetForm();
          }

          function scheduleMetadataFetch() {
            clearScheduledFetch();
            syncLoading(false);

            const currentURL = url().trim();
            if (!canFetchMetadata(currentURL)) {
              fetchSequence += 1;
              return;
            }

            const requestId = ++fetchSequence;
            fetchTimer = setTimeout(async () => {
              fetchTimer = null;
              syncLoading(true);
              try {
                const [titleResult, faviconResult] = await Promise.allSettled([
                  FetchPageTitle(currentURL),
                  FetchFavicon(currentURL),
                ]);
                if (requestId !== fetchSequence) {
                  return;
                }

                if (titleResult.status === "fulfilled" && titleResult.value) {
                  if (!titleValue().trim() || titleValue() === lastAutoTitle) {
                    titleValue(titleResult.value);
                    lastAutoTitle = titleResult.value;
                  }
                }

                if (
                  faviconResult.status === "fulfilled" &&
                  faviconResult.value
                ) {
                  if (!icon || icon === lastAutoIcon) {
                    icon = faviconResult.value;
                    lastAutoIcon = faviconResult.value;
                  }
                }
              } catch {
                // Metadata autofill is best effort only.
              } finally {
                if (requestId === fetchSequence) {
                  syncLoading(false);
                }
              }
            }, 800);
          }

          async function submitForm() {
            if (busy()) {
              return;
            }

            const nextURL = url().trim();
            if (!nextURL) {
              errorMessage("URL is required");
              urlInputEl.focus();
              return;
            }

            errorMessage("");
            busy(true);

            try {
              const bookmarkId = await AddBookmark(
                options.getParentFolderId(),
                {
                  title: titleValue().trim(),
                  url: nextURL,
                  icon,
                },
              );
              await treeState.actions.refresh();
              if (bookmarkId) {
                treeState.actions.selectSingle(bookmarkId);
              }
              uiState.actions.showToast("Bookmark added", "success");
              setOpen(false);
              options.onAdded?.();
            } catch (caughtError) {
              const message = getErrorMessage(
                caughtError,
                "Failed to add bookmark",
              );
              errorMessage(message);
              uiState.actions.showToast(message, "error");
            } finally {
              busy(false);
            }
          }

          function handleTriggerClick() {
            if (open()) {
              setOpen(false);
              return;
            }
            setOpen(true);
          }

          function handleCancelClick() {
            setOpen(false);
          }

          function handleSubmitClick() {
            void submitForm();
          }

          /** @param {KeyboardEvent} event */
          function handleFieldKeydown(event) {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              return;
            }

            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submitForm();
              return;
            }

            if (event.key === "Enter" && event.target === urlInputEl) {
              event.preventDefault();
              titleInputEl.focus();
            }
          }

          function handleURLInput() {
            errorMessage("");
            scheduleMetadataFetch();
          }

          function handleTitleInput() {
            errorMessage("");
          }

          trigger.addEventListener("click", handleTriggerClick);
          submit.addEventListener("click", handleSubmitClick);
          cancel.addEventListener("click", handleCancelClick);
          urlInputEl.addEventListener("keydown", handleFieldKeydown);
          titleInputEl.addEventListener("keydown", handleFieldKeydown);
          urlInputEl.addEventListener("input", handleURLInput);
          titleInputEl.addEventListener("input", handleTitleInput);

          cleanup.add(
            urlBinding.cleanup,
            titleBinding.cleanup,
            effect(() => {
              const available = options.isAvailable
                ? options.isAvailable()
                : Boolean(appState.currentFilePath());
              trigger.disabled = !available;
              if (!available) {
                setOpen(false);
              }
            }),
            fx(panel, (currentPanel) => {
              currentPanel.hidden = !open();
            }),
            fx(loading, (currentLoading) => {
              const active = loadingState();
              currentLoading.hidden = !active;
              currentLoading.setAttribute(
                "aria-hidden",
                active ? "false" : "true",
              );
            }),
            fx(error, (currentError) => {
              const message = errorMessage();
              currentError.hidden = message.length === 0;
              currentError.textContent = message;
            }),
            fx(submit, (currentSubmit) => {
              currentSubmit.disabled = busy();
            }),
            () => clearScheduledFetch(),
            () => trigger.removeEventListener("click", handleTriggerClick),
            () => submit.removeEventListener("click", handleSubmitClick),
            () => cancel.removeEventListener("click", handleCancelClick),
            () => urlInputEl.removeEventListener("keydown", handleFieldKeydown),
            () =>
              titleInputEl.removeEventListener("keydown", handleFieldKeydown),
            () => urlInputEl.removeEventListener("input", handleURLInput),
            () => titleInputEl.removeEventListener("input", handleTitleInput),
          );
        },
        onUnmount() {
          cleanup.run();
        },
      })
    );

  return renderAddBookmarkForm /*html*/ `
    <div class="add-bookmark-launcher">
      <button
        type="button"
        class="${options.triggerClassName ?? "btn btn-secondary btn-sm"}"
        data-ref="trigger"
        ${options.triggerKeyboardAction ? `data-keyboard-action="${options.triggerKeyboardAction}"` : ""}
        ${options.triggerAriaLabel ? `aria-label="${options.triggerAriaLabel}"` : ""}
        ${options.triggerTitle ? `title="${options.triggerTitle}"` : ""}
      >
        ${
          options.triggerIconClassName
            ? `<span class="${options.triggerIconClassName}" aria-hidden="true"></span>`
            : options.triggerLabel
        }
      </button>
      <div class="add-bookmark-panel" hidden data-ref="panel">
        <p class="label">${options.formTitle ?? "Create bookmark"}</p>
        <div class="field">
          <div class="add-bookmark-panel__url-row">
            <input
              type="url"
              class="input"
              placeholder="https://example.com"
              data-keyboard-action="add-bookmark-url"
              data-ref="urlInput"
            />
            <span
              class="spinner spinner-sm add-bookmark-panel__spinner"
              hidden
              aria-hidden="true"
              data-ref="loading"
            ></span>
          </div>
        </div>
        <div class="field">
          <input
            type="text"
            class="input"
            placeholder="Title (auto-filled)"
            data-keyboard-action="add-bookmark-title"
            data-ref="titleInput"
          />
          <p class="error-text" hidden data-ref="error"></p>
        </div>
        <div class="detail-inline-actions">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-keyboard-action="add-bookmark-submit"
            data-ref="submit"
          >
            ${options.submitLabel ?? "Add Bookmark"}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-ref="cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
}
