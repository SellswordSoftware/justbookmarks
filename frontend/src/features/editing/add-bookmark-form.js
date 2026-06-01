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
  listener,
  model,
  raw,
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
 * @returns {Component<HTMLElement>}
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
    /** @type {TemplateTag} */ (
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
          const panelEl = panel;
          const detailPaneContent = panelEl.closest(".detail-pane__content");
          const treePane = panelEl.closest(".tree-pane");
          let isPositionListenerAttached = false;
          const urlBinding = model(urlInputEl, url, { reactive: true });
          const titleBinding = model(titleInputEl, titleValue, {
            reactive: true,
          });

          /**
           * @param {number} value
           * @param {number} min
           * @param {number} max
           * @returns {number}
           */
          function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
          }

          function clearPanelPlacement() {
            panelEl.style.removeProperty("left");
            panelEl.style.removeProperty("right");
            panelEl.style.removeProperty("top");
            panelEl.style.removeProperty("bottom");
          }

          function positionPanel() {
            const inDetailActions = Boolean(panelEl.closest(".detail-inline-actions"));
            const inTreeActions = Boolean(panelEl.closest(".tree-pane__actions"));
            const boundaryContainer = inDetailActions
              ? detailPaneContent
              : inTreeActions
                ? treePane
                : null;
            if (!(boundaryContainer instanceof HTMLElement)) {
              return;
            }
            const launcher = panelEl.parentElement;
            if (!(launcher instanceof HTMLElement)) {
              return;
            }

            // Start from default "below + right aligned" placement.
            panelEl.style.left = "0px";
            panelEl.style.right = "auto";
            panelEl.style.top = "calc(100% + 0.4rem)";
            panelEl.style.bottom = "auto";

            const margin = 8;
            const gap = 6;
            const containerRect = boundaryContainer.getBoundingClientRect();
            const launcherRect = launcher.getBoundingClientRect();
            const panelRect = panelEl.getBoundingClientRect();
            if (panelRect.width === 0 || panelRect.height === 0) {
              return;
            }

            const defaultLeft = launcherRect.width - panelRect.width;
            const minLeft = containerRect.left + margin - launcherRect.left;
            const maxLeft = containerRect.right - margin - panelRect.width - launcherRect.left;
            const nextLeft = minLeft <= maxLeft
              ? clamp(defaultLeft, minLeft, maxLeft)
              : minLeft;
            panelEl.style.left = `${Math.round(nextLeft)}px`;

            const spaceBelow = containerRect.bottom - launcherRect.bottom - margin;
            const spaceAbove = launcherRect.top - containerRect.top - margin;
            const shouldOpenUp =
              spaceBelow < panelRect.height + gap && spaceAbove > spaceBelow;

            if (shouldOpenUp) {
              panelEl.style.top = "auto";
              panelEl.style.bottom = `${Math.round(launcherRect.height + gap)}px`;
            }
          }

          function attachPositionListeners() {
            if (isPositionListenerAttached) {
              return;
            }
            if (detailPaneContent instanceof HTMLElement && panelEl.closest(".detail-inline-actions")) {
              detailPaneContent.addEventListener("scroll", positionPanel);
            }
            window.addEventListener("resize", positionPanel);
            isPositionListenerAttached = true;
          }

          function detachPositionListeners() {
            if (!isPositionListenerAttached) {
              return;
            }
            if (detailPaneContent instanceof HTMLElement) {
              detailPaneContent.removeEventListener("scroll", positionPanel);
            }
            window.removeEventListener("resize", positionPanel);
            isPositionListenerAttached = false;
          }

          /**
           * @param {boolean} nextOpen
           * @returns {void}
           */
          function setOpen(nextOpen) {
            open(nextOpen);
            if (nextOpen) {
              attachPositionListeners();
              queueMicrotask(() => {
                positionPanel();
                urlInputEl.focus();
              });
              return;
            }
            detachPositionListeners();
            clearPanelPlacement();
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
              const createdBookmark = await AddBookmark(
                options.getParentFolderId(),
                {
                  title: titleValue().trim(),
                  url: nextURL,
                  icon,
                },
              );
              const inserted = treeState.actions.insertFlatNode(
                createdBookmark.parentId,
                createdBookmark,
              );
              if (!inserted) {
                await treeState.actions.refresh();
              }
              if (treeState.selectors.getNode(createdBookmark.id)) {
                treeState.actions.selectSingle(createdBookmark.id);
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

          cleanup.add(
          listener(trigger, "click", handleTriggerClick),
          listener(submit, "click", handleSubmitClick),
          listener(cancel, "click", handleCancelClick),
          listener(urlInputEl, "keydown", handleFieldKeydown),
          listener(titleInputEl, "keydown", handleFieldKeydown),
          listener(urlInputEl, "input", handleURLInput),
          listener(titleInputEl, "input", handleTitleInput),
        );

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
          () => detachPositionListeners(),
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
        ${raw(options.triggerKeyboardAction ? `data-keyboard-action="${options.triggerKeyboardAction}"` : "")}
        ${raw(options.triggerAriaLabel ? `aria-label="${options.triggerAriaLabel}"` : "")}
        ${raw(options.triggerTitle ? `title="${options.triggerTitle}"` : "")}
      >
        ${raw(
          options.triggerIconClassName
            ? `<span class="${options.triggerIconClassName}" aria-hidden="true"></span>`
            : options.triggerLabel
        )}
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
