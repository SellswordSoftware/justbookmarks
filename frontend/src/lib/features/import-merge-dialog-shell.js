// @ts-check

/**
 * @typedef {object} ImportMergeDialogViewState
 * @property {string} importPath
 * @property {boolean} previewLoading
 * @property {boolean} applyLoading
 * @property {string} error
 * @property {import("../../types.js").MergePreview | null} preview
 */

/**
 * @typedef {object} ImportMergeDialogElements
 * @property {HTMLDivElement} backdrop
 * @property {HTMLDivElement} dialog
 * @property {HTMLDivElement} body
 * @property {HTMLButtonElement} closeButton
 * @property {HTMLButtonElement} chooseFileButton
 * @property {HTMLButtonElement} cancelButton
 * @property {HTMLButtonElement} applyButton
 */

/**
 * @param {ImportMergeDialogViewState} view
 * @returns {ImportMergeDialogElements}
 */
export function createImportMergeDialogShell(view) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "modal import-merge-dialog";
  dialog.setAttribute("data-focus-zone", "dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "import-merge-title");
  dialog.tabIndex = -1;

  const body = document.createElement("div");
  body.className = "modal__body import-merge-dialog__body";

  const header = document.createElement("div");
  header.className = "import-merge-dialog__header";

  const headingBlock = document.createElement("div");
  const heading = document.createElement("h2");
  heading.id = "import-merge-title";
  heading.className = "import-merge-dialog__title";
  heading.textContent = "Import and Merge";

  const subtitle = document.createElement("p");
  subtitle.className = "import-merge-dialog__subtitle";
  subtitle.textContent = "Review additive changes before updating the current bookmark file.";
  headingBlock.append(heading, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "btn btn-ghost btn-sm btn-square";
  closeButton.setAttribute("aria-label", "Close import merge dialog");
  closeButton.textContent = "x";

  header.append(headingBlock, closeButton);
  body.append(header);

  const fileBar = document.createElement("div");
  fileBar.className = "import-merge-dialog__file-bar";

  const fileMeta = document.createElement("div");
  fileMeta.className = "import-merge-dialog__file-meta";

  const fileLabel = document.createElement("div");
  fileLabel.className = "import-merge-dialog__file-label";
  fileLabel.textContent = "Import file";

  const fileValue = document.createElement("div");
  fileValue.className = "import-merge-dialog__file-value";
  fileValue.textContent = view.importPath || "No file selected";

  const chooseFileButton = document.createElement("button");
  chooseFileButton.type = "button";
  chooseFileButton.className = "btn btn-outline btn-sm";
  chooseFileButton.textContent = "Choose File";
  chooseFileButton.setAttribute("data-keyboard-action", "import-choose-file");
  chooseFileButton.disabled = view.previewLoading || view.applyLoading;

  fileMeta.append(fileLabel, fileValue);
  fileBar.append(fileMeta, chooseFileButton);
  body.append(fileBar);

  if (view.error) {
    const alert = document.createElement("div");
    alert.className = "alert alert-error";
    const message = document.createElement("span");
    message.textContent = view.error;
    alert.append(message);
    body.append(alert);
  }

  const footer = document.createElement("div");
  footer.className = "modal__footer";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "btn btn-ghost";
  cancelButton.textContent = "Cancel";
  cancelButton.setAttribute("data-keyboard-action", "import-cancel");
  cancelButton.disabled = view.applyLoading;

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "btn btn-primary";
  applyButton.setAttribute("data-keyboard-action", "import-apply");
  applyButton.disabled = !view.preview || view.previewLoading || view.applyLoading;
  applyButton.textContent = view.applyLoading ? "Applying..." : "Apply Merge";

  footer.append(cancelButton, applyButton);
  dialog.append(body, footer);
  backdrop.append(dialog);

  return {
    backdrop,
    dialog,
    body,
    closeButton,
    chooseFileButton,
    cancelButton,
    applyButton,
  };
}
