// @ts-check

import { cleanupCollector, fx, model, signal } from "../../../shared/runtime/naf-html.js";
import { createBookmarkDetailActions } from "../actions/bookmark-detail-actions.js";
import { createBookmarkMetadataWorkflow } from "../actions/bookmark-detail-metadata.js";
import { createBookmarkDetailShell } from "./bookmark-detail-shell.js";

/**
 * @typedef {import("../../../types.js").BookmarkNode} BookmarkNode
 */

/**
 * @param {string} value
 * @returns {boolean}
 */
function hasRealDate(value) {
  return Boolean(value) && !String(value).startsWith("0001-01-01");
}

/**
 * @param {BookmarkNode} bookmark
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function createBookmarkDetail(bookmark) {
  const shell = createBookmarkDetailShell(bookmark);

  const editing = signal(false);
  const fetchingTitle = signal(false);
  const fetchingFavicon = signal(false);
  const currentTitle = signal(bookmark.bookmark.title || "");
  const currentURL = signal(bookmark.bookmark.url || "");
  const currentIcon = signal(bookmark.bookmark.icon || "");
  const currentMeta = signal(bookmark.bookmark.meta || "");
  const detailError = signal("");
  const titleBinding = model(shell.titleInput, currentTitle, { reactive: true });
  const urlBinding = model(shell.urlInput, currentURL, { reactive: true });
  const metaBinding = model(shell.notesInput, currentMeta, { reactive: true });
  const cleanup = cleanupCollector(
    titleBinding.cleanup,
    urlBinding.cleanup,
    metaBinding.cleanup,
  );
  const metadata = createBookmarkMetadataWorkflow({
    isEditing: () => editing(),
    getCurrentURL: () => currentURL(),
    getCurrentTitle: () => currentTitle(),
    getCurrentIcon: () => currentIcon(),
    setCurrentTitle: (value) => currentTitle(value),
    setCurrentIcon: (value) => currentIcon(value),
    setFetchingTitle: (value) => fetchingTitle(value),
    setDetailError: (message) => detailError(message),
  });

  function resetFromBookmark() {
    currentTitle(bookmark.bookmark.title || "");
    currentURL(bookmark.bookmark.url || "");
    currentIcon(bookmark.bookmark.icon || "");
    currentMeta(bookmark.bookmark.meta || "");
    metadata.resetTracking(currentTitle(), currentIcon());
    detailError("");
  }

  function setEditing(nextEditing) {
    editing(nextEditing);
    if (!nextEditing) {
      metadata.cancelOutstandingFetches();
      resetFromBookmark();
    }
    if (nextEditing) {
      queueMicrotask(() => {
        shell.titleInput.focus();
        shell.titleInput.select();
      });
    }
  }
  metadata.resetTracking(currentTitle(), currentIcon());
  const actions = createBookmarkDetailActions({
    bookmark,
    getCurrentTitle: () => currentTitle(),
    getCurrentURL: () => currentURL(),
    getCurrentIcon: () => currentIcon(),
    getCurrentMeta: () => currentMeta(),
    setCurrentIcon: (value) => currentIcon(value),
    setEditing,
    setFetchingFavicon: (value) => fetchingFavicon(value),
    setDetailError: (message) => detailError(message),
    focusInvalidURL() {
      shell.urlInput.focus();
    },
    resetMetadataTracking: metadata.resetTracking,
  });

  /** @param {KeyboardEvent} event */
  function handleEditKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void actions.saveBookmark();
    }
  }

  function handleTitleInput() {
    detailError("");
  }

  function handleURLInput() {
    detailError("");
    metadata.scheduleMetadataFetch();
  }

  function handleMetaInput() {
    detailError("");
  }

  function handleOpenLinkClick(event) {
    event.preventDefault();
    void actions.openInBrowser();
  }

  function handleEditClick() {
    setEditing(true);
  }

  function handleCancelClick() {
    setEditing(false);
  }

  function handleSaveClick() {
    void actions.saveBookmark();
  }

  function handleFetchFaviconClick() {
    void actions.fetchFaviconNow();
  }

  function handleOpenClick() {
    void actions.openInBrowser();
  }

  shell.editButton.addEventListener("click", handleEditClick);
  shell.moveButton.addEventListener("click", actions.showMoveDialog);
  shell.deleteButton.addEventListener("click", actions.showDeleteConfirm);
  shell.saveButton.addEventListener("click", handleSaveClick);
  shell.cancelButton.addEventListener("click", handleCancelClick);
  shell.openButton.addEventListener("click", handleOpenClick);
  shell.faviconButton.addEventListener("click", handleFetchFaviconClick);
  shell.urlLink.addEventListener("click", handleOpenLinkClick);
  shell.titleInput.addEventListener("keydown", handleEditKeydown);
  shell.urlInput.addEventListener("keydown", handleEditKeydown);
  shell.notesInput.addEventListener("keydown", handleEditKeydown);
  shell.titleInput.addEventListener("input", handleTitleInput);
  shell.urlInput.addEventListener("input", handleURLInput);
  shell.notesInput.addEventListener("input", handleMetaInput);
  cleanup.add(
    fx(shell.titleHeading, (currentTitleHeading) => {
      currentTitleHeading.hidden = editing();
      currentTitleHeading.textContent = bookmark.bookmark.title || "(Untitled)";
    }),
    fx(shell.titleInput, (currentTitleInput) => {
      currentTitleInput.hidden = !editing();
    }),
    fx(shell.urlLink, (currentURLLink) => {
      currentURLLink.hidden = editing();
      currentURLLink.textContent = bookmark.bookmark.url || "No URL set";
    }),
    fx(shell.urlInputWrap, (currentURLInputWrap) => {
      currentURLInputWrap.hidden = !editing();
    }),
    fx(shell.saveButton, (currentSaveButton) => {
      currentSaveButton.hidden = !editing();
      currentSaveButton.disabled = fetchingFavicon();
    }),
    fx(shell.cancelButton, (currentCancelButton) => {
      currentCancelButton.hidden = !editing();
    }),
    fx(shell.editButton, (currentEditButton) => {
      currentEditButton.hidden = editing();
    }),
    fx(shell.moveButton, (currentMoveButton) => {
      currentMoveButton.hidden = editing();
    }),
    fx(shell.deleteButton, (currentDeleteButton) => {
      currentDeleteButton.hidden = editing();
    }),
    fx(shell.actionRow, (currentActionRow) => {
      currentActionRow.hidden = editing();
    }),
    fx(shell.openButton, (currentOpenButton) => {
      currentOpenButton.disabled = !bookmark.bookmark.url;
    }),
    fx(shell.faviconButton, (currentFaviconButton) => {
      const active = fetchingFavicon();
      currentFaviconButton.disabled = active || !currentURL().trim();
      currentFaviconButton.textContent = active ? "Fetching..." : "Fetch Favicon";
    }),
    fx(shell.titleLoading, (currentTitleLoading) => {
      const active = fetchingTitle();
      currentTitleLoading.hidden = !active;
      currentTitleLoading.setAttribute("aria-hidden", active ? "false" : "true");
    }),
    fx(shell.iconImage, (currentIconImage) => {
      const displayIcon = editing() ? currentIcon() || bookmark.bookmark.icon : bookmark.bookmark.icon;
      if (displayIcon) {
        currentIconImage.hidden = false;
        currentIconImage.src = displayIcon;
      } else {
        currentIconImage.hidden = true;
        currentIconImage.removeAttribute("src");
      }
    }),
    fx(shell.fallbackIcon, (currentFallbackIcon) => {
      const displayIcon = editing() ? currentIcon() || bookmark.bookmark.icon : bookmark.bookmark.icon;
      currentFallbackIcon.hidden = Boolean(displayIcon);
    }),
    fx(shell.addedDate, (currentAddedDate) => {
      const hasDate = hasRealDate(bookmark.bookmark.addDate);
      currentAddedDate.hidden = !hasDate;
      currentAddedDate.textContent = hasDate
        ? `Added: ${new Date(bookmark.bookmark.addDate).toLocaleString()}`
        : "";
    }),
    fx(shell.modifiedDate, (currentModifiedDate) => {
      const hasDate = hasRealDate(bookmark.bookmark.lastModified);
      currentModifiedDate.hidden = !hasDate;
      currentModifiedDate.textContent = hasDate
        ? `Modified: ${new Date(bookmark.bookmark.lastModified).toLocaleString()}`
        : "";
    }),
    fx(shell.notesInput, (currentNotesInput) => {
      currentNotesInput.hidden = !editing();
    }),
    fx(shell.notesText, (currentNotesText) => {
      const nextMeta = currentMeta();
      currentNotesText.hidden = editing() || !nextMeta.trim();
      currentNotesText.textContent = nextMeta;
    }),
    fx(shell.notesEmpty, (currentNotesEmpty) => {
      currentNotesEmpty.hidden = editing() || Boolean(currentMeta().trim());
    }),
    fx(shell.detailsError, (currentDetailsError) => {
      const message = detailError();
      currentDetailsError.hidden = message.length === 0;
      currentDetailsError.textContent = message;
    }),
  );

  return {
    element: shell.wrapper,
    cleanup() {
      cleanup.run();
      metadata.clearScheduledFetch();
      shell.editButton.removeEventListener("click", handleEditClick);
      shell.moveButton.removeEventListener("click", actions.showMoveDialog);
      shell.deleteButton.removeEventListener("click", actions.showDeleteConfirm);
      shell.saveButton.removeEventListener("click", handleSaveClick);
      shell.cancelButton.removeEventListener("click", handleCancelClick);
      shell.openButton.removeEventListener("click", handleOpenClick);
      shell.faviconButton.removeEventListener("click", handleFetchFaviconClick);
      shell.urlLink.removeEventListener("click", handleOpenLinkClick);
      shell.titleInput.removeEventListener("keydown", handleEditKeydown);
      shell.urlInput.removeEventListener("keydown", handleEditKeydown);
      shell.notesInput.removeEventListener("keydown", handleEditKeydown);
      shell.titleInput.removeEventListener("input", handleTitleInput);
      shell.urlInput.removeEventListener("input", handleURLInput);
      shell.notesInput.removeEventListener("input", handleMetaInput);
    },
  };
}
