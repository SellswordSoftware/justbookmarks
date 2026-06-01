// @ts-check

import { cleanupCollector, listener } from "../../shared/runtime/naf.js";
import { trapFocusInContainer } from "../../shared/infra/focus.js";
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
 * @param {{ preview: MergePreview | null, previewLoading: boolean, applyLoading: boolean }} view
 * @returns {() => void}
 */
export function bindImportMergeDialogInteractions(elements, view) {
  const closeDialog = () => {
    importMergeState.actions.closeImportMergeDialog();
  };
  /** @param {MouseEvent} event */
  const handleBackdropClick = (event) => {
    if (event.target === elements.backdrop) {
      closeDialog();
    }
  };
  /** @param {MouseEvent} event */
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

  queueMicrotask(() => {
    if (!elements.chooseFileButton.disabled) {
      elements.chooseFileButton.focus();
      return;
    }
    elements.cancelButton.focus();
  });

  const cleanup = cleanupCollector(
    listener(elements.backdrop, "click", handleBackdropClick),
    listener(elements.dialog, "click", handleDialogClick),
    listener(elements.dialog, "keydown", handleDialogKeydown),
    listener(elements.closeButton, "click", handleCloseClick),
    listener(elements.cancelButton, "click", handleCancelClick),
    listener(elements.chooseFileButton, "click", handleChooseFileClick),
    listener(elements.applyButton, "click", handleApplyClick),
  );

  return () => {
    cleanup.run();
  };
}
