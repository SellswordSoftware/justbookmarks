// @ts-check

import {
  cleanupCollector,
  fx,
  model,
  signal,
  template,
} from "../../../shared/runtime/naf.js";
import { createBookmarkDetailActions } from "../actions/bookmark-detail-actions.js";
import { createBookmarkMetadataWorkflow } from "../actions/bookmark-detail-metadata.js";

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
 * @returns {import("../../../shared/runtime/naf.js").Component<HTMLElement>}
 */
export function createBookmarkDetail(bookmark) {
  const editing = signal(false);
  const fetchingTitle = signal(false);
  const fetchingFavicon = signal(false);
  const currentTitle = signal(bookmark.bookmark.title || "");
  const currentURL = signal(bookmark.bookmark.url || "");
  const currentIcon = signal(bookmark.bookmark.icon || "");
  const currentMeta = signal(bookmark.bookmark.meta || "");
  const detailError = signal("");
  const cleanup = cleanupCollector();

  const renderBookmarkDetail = /** @type {TemplateTag} */ (
    template({
      root: ".bookmark-detail",
      onMount(_el, _parent, ctx) {
        const titleHeading = ctx.refs.titleHeading;
        const titleInput = ctx.refs.titleInput;
        const editButton = ctx.refs.editButton;
        const moveButton = ctx.refs.moveButton;
        const deleteButton = ctx.refs.deleteButton;
        const saveButton = ctx.refs.saveButton;
        const cancelButton = ctx.refs.cancelButton;
        const urlLink = ctx.refs.urlLink;
        const urlInputWrap = ctx.refs.urlInputWrap;
        const urlInput = ctx.refs.urlInput;
        const titleLoading = ctx.refs.titleLoading;
        const actionRow = ctx.refs.actionRow;
        const openButton = ctx.refs.openButton;
        const faviconButton = ctx.refs.faviconButton;
        const detailsError = ctx.refs.detailsError;
        const iconImage = ctx.refs.iconImage;
        const fallbackIcon = ctx.refs.fallbackIcon;
        const addedDate = ctx.refs.addedDate;
        const modifiedDate = ctx.refs.modifiedDate;
        const notesText = ctx.refs.notesText;
        const notesEmpty = ctx.refs.notesEmpty;
        const notesInput = ctx.refs.notesInput;

        if (!(titleHeading instanceof HTMLHeadingElement)) {
          throw new Error("Expected bookmark detail title heading");
        }
        if (!(titleInput instanceof HTMLInputElement)) {
          throw new Error("Expected bookmark detail title input");
        }
        if (!(editButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail edit button");
        }
        if (!(moveButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail move button");
        }
        if (!(deleteButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail delete button");
        }
        if (!(saveButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail save button");
        }
        if (!(cancelButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail cancel button");
        }
        if (!(urlLink instanceof HTMLAnchorElement)) {
          throw new Error("Expected bookmark detail URL link");
        }
        if (!(urlInputWrap instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail URL input wrap");
        }
        if (!(urlInput instanceof HTMLInputElement)) {
          throw new Error("Expected bookmark detail URL input");
        }
        if (!(titleLoading instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail title loading indicator");
        }
        if (!(actionRow instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail action row");
        }
        if (!(openButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail open button");
        }
        if (!(faviconButton instanceof HTMLButtonElement)) {
          throw new Error("Expected bookmark detail favicon button");
        }
        if (!(detailsError instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail error element");
        }
        if (!(iconImage instanceof HTMLImageElement)) {
          throw new Error("Expected bookmark detail icon image");
        }
        if (!(fallbackIcon instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail fallback icon");
        }
        if (!(addedDate instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail added date");
        }
        if (!(modifiedDate instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail modified date");
        }
        if (!(notesText instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail notes text");
        }
        if (!(notesEmpty instanceof HTMLElement)) {
          throw new Error("Expected bookmark detail empty notes label");
        }
        if (!(notesInput instanceof HTMLTextAreaElement)) {
          throw new Error("Expected bookmark detail notes input");
        }

        const titleInputEl = titleInput;
        const urlInputEl = urlInput;
        const notesInputEl = notesInput;
        const titleBinding = model(titleInputEl, currentTitle, { reactive: true });
        const urlBinding = model(urlInputEl, currentURL, { reactive: true });
        const metaBinding = model(notesInputEl, currentMeta, { reactive: true });
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

        /**
         * @param {boolean} nextEditing
         * @returns {void}
         */
        function setEditing(nextEditing) {
          editing(nextEditing);
          if (!nextEditing) {
            metadata.cancelOutstandingFetches();
            resetFromBookmark();
          }
          if (nextEditing) {
            queueMicrotask(() => {
              titleInputEl.focus();
              titleInputEl.select();
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
            urlInputEl.focus();
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

        /** @param {MouseEvent} event */
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

        editButton.addEventListener("click", handleEditClick);
        moveButton.addEventListener("click", actions.showMoveDialog);
        deleteButton.addEventListener("click", actions.showDeleteConfirm);
        saveButton.addEventListener("click", handleSaveClick);
        cancelButton.addEventListener("click", handleCancelClick);
        openButton.addEventListener("click", handleOpenClick);
        faviconButton.addEventListener("click", handleFetchFaviconClick);
        urlLink.addEventListener("click", handleOpenLinkClick);
        titleInputEl.addEventListener("keydown", handleEditKeydown);
        urlInputEl.addEventListener("keydown", handleEditKeydown);
        notesInputEl.addEventListener("keydown", handleEditKeydown);
        titleInputEl.addEventListener("input", handleTitleInput);
        urlInputEl.addEventListener("input", handleURLInput);
        notesInputEl.addEventListener("input", handleMetaInput);

        cleanup.add(
          titleBinding.cleanup,
          urlBinding.cleanup,
          metaBinding.cleanup,
          fx(titleHeading, (currentTitleHeading) => {
            currentTitleHeading.hidden = editing();
            currentTitleHeading.textContent = bookmark.bookmark.title || "(Untitled)";
          }),
          fx(titleInput, (currentTitleInput) => {
            currentTitleInput.hidden = !editing();
          }),
          fx(urlLink, (currentURLLink) => {
            currentURLLink.hidden = editing();
            currentURLLink.textContent = bookmark.bookmark.url || "No URL set";
          }),
          fx(urlInputWrap, (currentURLInputWrap) => {
            currentURLInputWrap.hidden = !editing();
          }),
          fx(saveButton, (currentSaveButton) => {
            currentSaveButton.hidden = !editing();
            currentSaveButton.disabled = fetchingFavicon();
          }),
          fx(cancelButton, (currentCancelButton) => {
            currentCancelButton.hidden = !editing();
          }),
          fx(editButton, (currentEditButton) => {
            currentEditButton.hidden = editing();
          }),
          fx(moveButton, (currentMoveButton) => {
            currentMoveButton.hidden = editing();
          }),
          fx(deleteButton, (currentDeleteButton) => {
            currentDeleteButton.hidden = editing();
          }),
          fx(actionRow, (currentActionRow) => {
            currentActionRow.hidden = editing();
          }),
          fx(openButton, (currentOpenButton) => {
            currentOpenButton.disabled = !bookmark.bookmark.url;
          }),
          fx(faviconButton, (currentFaviconButton) => {
            const active = fetchingFavicon();
            currentFaviconButton.disabled = active || !currentURL().trim();
            currentFaviconButton.textContent = active ? "Fetching..." : "Fetch Favicon";
          }),
          fx(titleLoading, (currentTitleLoading) => {
            const active = fetchingTitle();
            currentTitleLoading.hidden = !active;
            currentTitleLoading.setAttribute("aria-hidden", active ? "false" : "true");
          }),
          fx(iconImage, (currentIconImage) => {
            const displayIcon = editing()
              ? currentIcon() || bookmark.bookmark.icon
              : bookmark.bookmark.icon;
            if (displayIcon) {
              currentIconImage.hidden = false;
              currentIconImage.src = displayIcon;
            } else {
              currentIconImage.hidden = true;
              currentIconImage.removeAttribute("src");
            }
          }),
          fx(fallbackIcon, (currentFallbackIcon) => {
            const displayIcon = editing()
              ? currentIcon() || bookmark.bookmark.icon
              : bookmark.bookmark.icon;
            currentFallbackIcon.hidden = Boolean(displayIcon);
          }),
          fx(addedDate, (currentAddedDate) => {
            const hasDate = hasRealDate(bookmark.bookmark.addDate);
            currentAddedDate.hidden = !hasDate;
            currentAddedDate.textContent = hasDate
              ? `Added: ${new Date(bookmark.bookmark.addDate).toLocaleString()}`
              : "";
          }),
          fx(modifiedDate, (currentModifiedDate) => {
            const hasDate = hasRealDate(bookmark.bookmark.lastModified);
            currentModifiedDate.hidden = !hasDate;
            currentModifiedDate.textContent = hasDate
              ? `Modified: ${new Date(bookmark.bookmark.lastModified).toLocaleString()}`
              : "";
          }),
          fx(notesInput, (currentNotesInput) => {
            currentNotesInput.hidden = !editing();
          }),
          fx(notesText, (currentNotesText) => {
            const nextMeta = currentMeta();
            currentNotesText.hidden = editing() || !nextMeta.trim();
            currentNotesText.textContent = nextMeta;
          }),
          fx(notesEmpty, (currentNotesEmpty) => {
            currentNotesEmpty.hidden = editing() || Boolean(currentMeta().trim());
          }),
          fx(detailsError, (currentDetailsError) => {
            const message = detailError();
            currentDetailsError.hidden = message.length === 0;
            currentDetailsError.textContent = message;
          }),
          () => metadata.clearScheduledFetch(),
          () => metadata.cancelOutstandingFetches(),
          () => editButton.removeEventListener("click", handleEditClick),
          () => moveButton.removeEventListener("click", actions.showMoveDialog),
          () => deleteButton.removeEventListener("click", actions.showDeleteConfirm),
          () => saveButton.removeEventListener("click", handleSaveClick),
          () => cancelButton.removeEventListener("click", handleCancelClick),
          () => openButton.removeEventListener("click", handleOpenClick),
          () => faviconButton.removeEventListener("click", handleFetchFaviconClick),
          () => urlLink.removeEventListener("click", handleOpenLinkClick),
          () => titleInputEl.removeEventListener("keydown", handleEditKeydown),
          () => urlInputEl.removeEventListener("keydown", handleEditKeydown),
          () => notesInputEl.removeEventListener("keydown", handleEditKeydown),
          () => titleInputEl.removeEventListener("input", handleTitleInput),
          () => urlInputEl.removeEventListener("input", handleURLInput),
          () => notesInputEl.removeEventListener("input", handleMetaInput),
        );
      },
      onUnmount() {
        cleanup.run();
      },
    })
  );

  return renderBookmarkDetail/*html*/`
    <div class="bookmark-detail">
      <div class="bookmark-detail__header">
        <div class="bookmark-detail__top-row">
          <div class="bookmark-detail__identity">
            <img class="bookmark-detail__icon-image" alt="" hidden data-ref="iconImage" />
            <div class="bookmark-detail__icon-fallback" data-ref="fallbackIcon">🔖</div>
            <div class="bookmark-detail__title-block">
              <h3 class="bookmark-detail__title" data-ref="titleHeading"></h3>
              <input
                type="text"
                class="input"
                hidden
                placeholder="Title"
                data-keyboard-action="bookmark-title"
                data-ref="titleInput"
              />
            </div>
          </div>
          <div class="detail-inline-actions">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              data-keyboard-action="bookmark-edit"
              data-ref="editButton"
            >
              Edit
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              data-keyboard-action="bookmark-move"
              data-ref="moveButton"
            >
              Move...
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              data-keyboard-action="bookmark-delete"
              data-ref="deleteButton"
            >
              Delete
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              hidden
              data-keyboard-action="bookmark-save"
              data-ref="saveButton"
            >
              Save
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              hidden
              data-keyboard-action="bookmark-cancel"
              data-ref="cancelButton"
            >
              Cancel
            </button>
          </div>
        </div>
        <div class="bookmark-detail__url-row">
          <a href="#" class="bookmark-detail__url-link" data-ref="urlLink"></a>
          <div class="bookmark-detail__url-input-wrap" hidden data-ref="urlInputWrap">
            <input
              type="url"
              class="input"
              placeholder="https://example.com"
              data-keyboard-action="bookmark-url"
              data-ref="urlInput"
            />
            <span
              class="spinner spinner-sm bookmark-detail__spinner"
              hidden
              aria-hidden="true"
              data-ref="titleLoading"
            ></span>
          </div>
        </div>
        <div class="detail-inline-actions" data-ref="actionRow">
          <button
            type="button"
            class="btn btn-outline btn-primary btn-sm"
            data-keyboard-action="bookmark-open"
            data-ref="openButton"
          >
            Open
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-keyboard-action="bookmark-fetch-favicon"
            data-ref="faviconButton"
          >
            Fetch Favicon
          </button>
        </div>
        <p class="error-text" hidden data-ref="detailsError"></p>
        <div class="bookmark-detail__dates">
          <p data-ref="addedDate"></p>
          <p data-ref="modifiedDate"></p>
        </div>
      </div>
      <div class="bookmark-detail__notes">
        <label class="label" for="bookmark-notes-${bookmark.id}">Notes</label>
        <p class="bookmark-detail__notes-text" data-ref="notesText"></p>
        <p class="bookmark-detail__notes-empty" data-ref="notesEmpty">No notes</p>
        <textarea
          id="bookmark-notes-${bookmark.id}"
          class="textarea"
          hidden
          placeholder="Add notes..."
          data-keyboard-action="bookmark-meta"
          data-ref="notesInput"
        ></textarea>
      </div>
    </div>
  `;
}
