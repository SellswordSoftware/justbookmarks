// @ts-check

import { AddBookmark, FetchFavicon, FetchPageTitle } from "../../shared/api/api.js";
import { cleanupCollector, effect, fx, model, signal } from "../../shared/runtime/naf-html.js";
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
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function createAddBookmarkForm(options) {
  const wrapper = document.createElement("div");
  wrapper.className = "add-bookmark-launcher";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = options.triggerClassName ?? "btn btn-secondary btn-sm";
  trigger.textContent = options.triggerLabel;
  if (options.triggerKeyboardAction) {
    trigger.setAttribute("data-keyboard-action", options.triggerKeyboardAction);
  }

  const panel = document.createElement("div");
  panel.className = "add-bookmark-panel";
  panel.hidden = true;

  const title = document.createElement("p");
  title.className = "label";
  title.textContent = options.formTitle ?? "Create bookmark";

  const urlField = document.createElement("div");
  urlField.className = "field";

  const urlRow = document.createElement("div");
  urlRow.className = "add-bookmark-panel__url-row";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "input";
  urlInput.placeholder = "https://example.com";
  urlInput.setAttribute("data-keyboard-action", "add-bookmark-url");

  const loading = document.createElement("span");
  loading.className = "spinner spinner-sm add-bookmark-panel__spinner";
  loading.hidden = true;
  loading.setAttribute("aria-hidden", "true");

  const titleField = document.createElement("div");
  titleField.className = "field";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "input";
  titleInput.placeholder = "Title (auto-filled)";
  titleInput.setAttribute("data-keyboard-action", "add-bookmark-title");

  const error = document.createElement("p");
  error.className = "error-text";
  error.hidden = true;

  const actions = document.createElement("div");
  actions.className = "detail-inline-actions";

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "btn btn-secondary btn-sm";
  submit.textContent = options.submitLabel ?? "Add Bookmark";
  submit.setAttribute("data-keyboard-action", "add-bookmark-submit");

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost btn-sm";
  cancel.textContent = "Cancel";

  urlRow.append(urlInput, loading);
  urlField.append(urlRow);
  titleField.append(titleInput, error);
  actions.append(submit, cancel);
  panel.append(title, urlField, titleField, actions);
  wrapper.append(trigger, panel);

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
  const urlBinding = model(urlInput, url, { reactive: true });
  const titleBinding = model(titleInput, titleValue, { reactive: true });
  const cleanup = cleanupCollector(urlBinding.cleanup, titleBinding.cleanup);

  function clearScheduledFetch() {
    if (fetchTimer !== null) {
      clearTimeout(fetchTimer);
      fetchTimer = null;
    }
  }

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

  /**
   * @param {boolean} nextOpen
   * @returns {void}
   */
  function setOpen(nextOpen) {
    open(nextOpen);
    if (nextOpen) {
      queueMicrotask(() => urlInput.focus());
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

        if (faviconResult.status === "fulfilled" && faviconResult.value) {
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
      urlInput.focus();
      return;
    }

    errorMessage("");
    busy(true);

    try {
      const bookmarkId = await AddBookmark(options.getParentFolderId(), {
        title: titleValue().trim(),
        url: nextURL,
        icon,
      });
      await treeState.actions.refresh();
      if (bookmarkId) {
        treeState.actions.selectSingle(bookmarkId);
      }
      uiState.actions.showToast("Bookmark added", "success");
      setOpen(false);
      options.onAdded?.();
    } catch (caughtError) {
      const message = getErrorMessage(caughtError, "Failed to add bookmark");
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

    if (event.key === "Enter" && event.target === urlInput) {
      event.preventDefault();
      titleInput.focus();
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
  urlInput.addEventListener("keydown", handleFieldKeydown);
  titleInput.addEventListener("keydown", handleFieldKeydown);
  urlInput.addEventListener("input", handleURLInput);
  titleInput.addEventListener("input", handleTitleInput);

  const stop = effect(() => {
    const available = options.isAvailable ? options.isAvailable() : Boolean(appState.selectors.getCurrentFilePath());
    trigger.disabled = !available;
    if (!available) {
      setOpen(false);
    }
  });
  cleanup.add(
    stop,
    fx(panel, (currentPanel) => {
      currentPanel.hidden = !open();
    }),
    fx(loading, (currentLoading) => {
      const active = loadingState();
      currentLoading.hidden = !active;
      currentLoading.setAttribute("aria-hidden", active ? "false" : "true");
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
    () => urlInput.removeEventListener("keydown", handleFieldKeydown),
    () => titleInput.removeEventListener("keydown", handleFieldKeydown),
    () => urlInput.removeEventListener("input", handleURLInput),
    () => titleInput.removeEventListener("input", handleTitleInput),
  );

  return {
    element: wrapper,
    cleanup() {
      cleanup.run();
    },
  };
}
