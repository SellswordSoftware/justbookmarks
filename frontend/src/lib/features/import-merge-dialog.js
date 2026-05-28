// @ts-check

import { effect } from "../naf-html.js";
import { importMergeState } from "../state/import-merge-state.js";
import { bindImportMergeDialogInteractions } from "./import-merge-dialog-interactions.js";
import { mountImportMergePreview } from "./import-merge-dialog-preview.js";
import { createImportMergeDialogShell } from "./import-merge-dialog-shell.js";

/**
 * @param {ParentNode} root
 * @returns {{ container: HTMLElement }}
 */
export function collectImportMergeDialogShell(root) {
  const container = root.querySelector("#import-merge-dialog-container");
  if (!(container instanceof HTMLElement)) {
    throw new Error("Expected #import-merge-dialog-container element");
  }

  return { container };
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountImportMergeDialog(shell) {
  let cleanupRendered = () => {};

  const stop = effect(() => {
    cleanupRendered();
    cleanupRendered = () => {};

    shell.container.replaceChildren();

    if (!importMergeState.selectors.isImportMergeOpen()) {
      return;
    }

    const importPath = importMergeState.selectors.getImportMergePath();
    const preview = importMergeState.selectors.getImportMergePreview();
    const previewLoading = importMergeState.selectors.isImportMergePreviewLoading();
    const applyLoading = importMergeState.selectors.isImportMergeApplyLoading();
    const error = importMergeState.selectors.getImportMergeError();

    const view = { importPath, preview, previewLoading, applyLoading, error };
    const elements = createImportMergeDialogShell(view);
    shell.container.append(elements.backdrop);

    const previewCleanup = mountImportMergePreview(elements.body, preview, previewLoading);
    const interactionCleanup = bindImportMergeDialogInteractions(elements, {
      preview,
      previewLoading,
      applyLoading,
    });

    cleanupRendered = () => {
      interactionCleanup();
      previewCleanup();
    };
  });

  return {
    cleanup() {
      cleanupRendered();
      stop();
    },
  };
}
