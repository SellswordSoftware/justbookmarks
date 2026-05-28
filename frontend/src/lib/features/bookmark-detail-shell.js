// @ts-check

/**
 * @typedef {import("../../types.js").BookmarkNode} BookmarkNode
 */

/**
 * @typedef {object} BookmarkDetailShell
 * @property {HTMLElement} wrapper
 * @property {HTMLHeadingElement} titleHeading
 * @property {HTMLInputElement} titleInput
 * @property {HTMLButtonElement} editButton
 * @property {HTMLButtonElement} moveButton
 * @property {HTMLButtonElement} deleteButton
 * @property {HTMLButtonElement} saveButton
 * @property {HTMLButtonElement} cancelButton
 * @property {HTMLAnchorElement} urlLink
 * @property {HTMLElement} urlInputWrap
 * @property {HTMLInputElement} urlInput
 * @property {HTMLElement} titleLoading
 * @property {HTMLElement} actionRow
 * @property {HTMLButtonElement} openButton
 * @property {HTMLButtonElement} faviconButton
 * @property {HTMLParagraphElement} detailsError
 * @property {HTMLImageElement} iconImage
 * @property {HTMLElement} fallbackIcon
 * @property {HTMLParagraphElement} addedDate
 * @property {HTMLParagraphElement} modifiedDate
 * @property {HTMLParagraphElement} notesText
 * @property {HTMLParagraphElement} notesEmpty
 * @property {HTMLTextAreaElement} notesInput
 */

/**
 * @param {BookmarkNode} bookmark
 * @returns {BookmarkDetailShell}
 */
export function createBookmarkDetailShell(bookmark) {
  const wrapper = document.createElement("div");
  wrapper.className = "bookmark-detail";

  const header = document.createElement("div");
  header.className = "bookmark-detail__header";

  const topRow = document.createElement("div");
  topRow.className = "bookmark-detail__top-row";

  const identity = document.createElement("div");
  identity.className = "bookmark-detail__identity";

  const iconImage = document.createElement("img");
  iconImage.className = "bookmark-detail__icon-image";
  iconImage.alt = "";
  iconImage.hidden = true;

  const fallbackIcon = document.createElement("div");
  fallbackIcon.className = "bookmark-detail__icon-fallback";
  fallbackIcon.textContent = "🔖";

  const titleBlock = document.createElement("div");
  titleBlock.className = "bookmark-detail__title-block";

  const titleHeading = document.createElement("h3");
  titleHeading.className = "bookmark-detail__title";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "input";
  titleInput.hidden = true;
  titleInput.placeholder = "Title";
  titleInput.setAttribute("data-keyboard-action", "bookmark-title");

  const actions = document.createElement("div");
  actions.className = "detail-inline-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "btn btn-ghost btn-sm";
  editButton.textContent = "Edit";
  editButton.setAttribute("data-keyboard-action", "bookmark-edit");

  const moveButton = document.createElement("button");
  moveButton.type = "button";
  moveButton.className = "btn btn-ghost btn-sm";
  moveButton.textContent = "Move...";
  moveButton.setAttribute("data-keyboard-action", "bookmark-move");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-danger btn-sm";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("data-keyboard-action", "bookmark-delete");

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "btn btn-primary btn-sm";
  saveButton.textContent = "Save";
  saveButton.hidden = true;
  saveButton.setAttribute("data-keyboard-action", "bookmark-save");

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn btn-ghost btn-sm";
  cancelButton.textContent = "Cancel";
  cancelButton.hidden = true;
  cancelButton.setAttribute("data-keyboard-action", "bookmark-cancel");

  const urlRow = document.createElement("div");
  urlRow.className = "bookmark-detail__url-row";

  const urlLink = document.createElement("a");
  urlLink.href = "#";
  urlLink.className = "bookmark-detail__url-link";

  const urlInputWrap = document.createElement("div");
  urlInputWrap.className = "bookmark-detail__url-input-wrap";
  urlInputWrap.hidden = true;

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "input";
  urlInput.placeholder = "https://example.com";
  urlInput.setAttribute("data-keyboard-action", "bookmark-url");

  const titleLoading = document.createElement("span");
  titleLoading.className = "spinner spinner-sm bookmark-detail__spinner";
  titleLoading.hidden = true;
  titleLoading.setAttribute("aria-hidden", "true");

  const actionRow = document.createElement("div");
  actionRow.className = "detail-inline-actions";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "btn btn-outline btn-primary btn-sm";
  openButton.textContent = "Open";
  openButton.setAttribute("data-keyboard-action", "bookmark-open");

  const faviconButton = document.createElement("button");
  faviconButton.type = "button";
  faviconButton.className = "btn btn-ghost btn-sm";
  faviconButton.textContent = "Fetch Favicon";
  faviconButton.setAttribute("data-keyboard-action", "bookmark-fetch-favicon");

  const detailsError = document.createElement("p");
  detailsError.className = "error-text";
  detailsError.hidden = true;

  const metaDates = document.createElement("div");
  metaDates.className = "bookmark-detail__dates";

  const addedDate = document.createElement("p");
  const modifiedDate = document.createElement("p");
  metaDates.append(addedDate, modifiedDate);

  const notesSection = document.createElement("div");
  notesSection.className = "bookmark-detail__notes";

  const notesLabel = document.createElement("label");
  notesLabel.className = "label";
  notesLabel.textContent = "Notes";
  notesLabel.htmlFor = `bookmark-notes-${bookmark.id}`;

  const notesText = document.createElement("p");
  notesText.className = "bookmark-detail__notes-text";

  const notesEmpty = document.createElement("p");
  notesEmpty.className = "bookmark-detail__notes-empty";
  notesEmpty.textContent = "No notes";

  const notesInput = document.createElement("textarea");
  notesInput.className = "textarea";
  notesInput.id = notesLabel.htmlFor;
  notesInput.hidden = true;
  notesInput.placeholder = "Add notes...";
  notesInput.setAttribute("data-keyboard-action", "bookmark-meta");

  titleBlock.append(titleHeading, titleInput);
  identity.append(iconImage, fallbackIcon, titleBlock);
  actions.append(editButton, moveButton, deleteButton, saveButton, cancelButton);
  topRow.append(identity, actions);
  urlInputWrap.append(urlInput, titleLoading);
  urlRow.append(urlLink, urlInputWrap);
  actionRow.append(openButton, faviconButton);
  notesSection.append(notesLabel, notesText, notesEmpty, notesInput);
  header.append(topRow, urlRow, actionRow, detailsError, metaDates);
  wrapper.append(header, notesSection);

  return {
    wrapper,
    titleHeading,
    titleInput,
    editButton,
    moveButton,
    deleteButton,
    saveButton,
    cancelButton,
    urlLink,
    urlInputWrap,
    urlInput,
    titleLoading,
    actionRow,
    openButton,
    faviconButton,
    detailsError,
    iconImage,
    fallbackIcon,
    addedDate,
    modifiedDate,
    notesText,
    notesEmpty,
    notesInput,
  };
}
