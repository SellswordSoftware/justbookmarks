// @ts-check

import { cleanupCollector } from "../../../shared/runtime/naf-html.js";
import { trapFocusInContainer } from "../../../shared/infra/focus.js";
import { importMergeState } from "./import-merge-state.js";

/**
 * @param {{
 *   backdrop: HTMLDivElement,
 *   dialog: HTMLDivElement,
 *   closeButton: HTMLButtonElement,
 *   chooseFileButton: HTMLButtonElement,
 *   cancelButton: HTMLButtonElement,
 *   applyButton: HTMLButtonElement,
 * }} elements
 * @param {{ preview: import("../../../types.js").MergePreview | null, previewLoading: boolean, applyLoading: boolean }} view
 * @returns {() => void}
 */
export function bindImportMergeDialogInteractions(elements, view) {
  const closeDialog = () => {
    importMergeState.actions.closeImportMergeDialog();
  };
  const handleBackdropClick = (event) => {
    if (event.target === elements.backdrop) {
      closeDialog();
    }
  };
  const handleDialogClick = (event) => {
    event.stopPropagation();
  };
  const handleCloseClick = () => {
    closeDialog();
  };
  const handleCancelClick = () => {
    closeDialog();
  };
  const handleChooseFileClick = () => {
    void importMergeState.actions.pickAnotherImportFile();
  };
  const handleApplyClick = () => {
    void importMergeState.actions.applyImportMerge();
  };
  /** @param {KeyboardEvent} event */
  const handleDialogKeydown = (event) => {
    if (trapFocusInContainer(event, elements.dialog)) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      view.preview &&
      !view.previewLoading &&
      !view.applyLoading
    ) {
      event.preventDefault();
      void importMergeState.actions.applyImportMerge();
    }
  };

  elements.backdrop.addEventListener("click", handleBackdropClick);
  elements.dialog.addEventListener("click", handleDialogClick);
  elements.dialog.addEventListener("keydown", handleDialogKeydown);
  elements.closeButton.addEventListener("click", handleCloseClick);
  elements.cancelButton.addEventListener("click", handleCancelClick);
  elements.chooseFileButton.addEventListener("click", handleChooseFileClick);
  elements.applyButton.addEventListener("click", handleApplyClick);

  queueMicrotask(() => {
    if (!elements.chooseFileButton.disabled) {
      elements.chooseFileButton.focus();
      return;
    }
    elements.cancelButton.focus();
  });

  const cleanup = cleanupCollector(
    () => elements.backdrop.removeEventListener("click", handleBackdropClick),
    () => elements.dialog.removeEventListener("click", handleDialogClick),
    () => elements.dialog.removeEventListener("keydown", handleDialogKeydown),
    () => elements.closeButton.removeEventListener("click", handleCloseClick),
    () => elements.cancelButton.removeEventListener("click", handleCancelClick),
    () => elements.chooseFileButton.removeEventListener("click", handleChooseFileClick),
    () => elements.applyButton.removeEventListener("click", handleApplyClick),
  );

  return () => {
    cleanup.run();
  };
}
