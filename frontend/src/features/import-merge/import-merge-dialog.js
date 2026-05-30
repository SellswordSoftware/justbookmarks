// @ts-check

import {
  attr,
  effect,
  mount,
  raw,
  template,
} from "../../shared/runtime/naf.js";
import { importMergeState } from "./import-merge-state.js";
import { bindImportMergeDialogInteractions } from "./import-merge-dialog-interactions.js";
import { mountImportMergePreview } from "./import-merge-dialog-preview.js";

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
 * @param {{
 *   importPath: string,
 *   preview: import("../../types.js").MergePreview | null,
 *   previewLoading: boolean,
 *   applyLoading: boolean,
 *   error: string
 * }} view
 * @param {(elements: ImportMergeDialogElements) => void} onMountElements
 * @returns {import("../../shared/runtime/naf.js").Component<HTMLElement>}
 */
function createImportMergeDialog(view, onMountElements) {
  const applyLabel = view.applyLoading ? "Applying..." : "Apply Merge";

  const errorComponent = view.error
    ? raw(`
        <div class="alert alert-error">
          <span>${view.error}</span>
        </div>
      `)
    : null;

  const renderDialog = /** @type {TemplateTag} */ (
    template({
      onMount(_el, _parent, ctx) {
        const backdrop = ctx.refs.backdrop;
        const dialog = ctx.refs.dialog;
        const body = ctx.refs.body;
        const closeButton = ctx.refs.closeButton;
        const chooseFileButton = ctx.refs.chooseFileButton;
        const cancelButton = ctx.refs.cancelButton;
        const applyButton = ctx.refs.applyButton;
        const filePath = ctx.refs.filePath;

        if (!(backdrop instanceof HTMLDivElement)) {
          throw new Error("Expected import merge backdrop");
        }
        if (!(dialog instanceof HTMLDivElement)) {
          throw new Error("Expected import merge dialog");
        }
        if (!(body instanceof HTMLDivElement)) {
          throw new Error("Expected import merge dialog body");
        }
        if (!(closeButton instanceof HTMLButtonElement)) {
          throw new Error("Expected import merge close button");
        }
        if (!(chooseFileButton instanceof HTMLButtonElement)) {
          throw new Error("Expected import merge choose file button");
        }
        if (!(cancelButton instanceof HTMLButtonElement)) {
          throw new Error("Expected import merge cancel button");
        }
        if (!(applyButton instanceof HTMLButtonElement)) {
          throw new Error("Expected import merge apply button");
        }
        if (!(filePath instanceof HTMLElement)) {
          throw new Error("Expected import merge file path");
        }

        filePath.textContent = view.importPath || "No file selected";
        applyButton.textContent = applyLabel;

        ctx.cleanup.add(
          attr(chooseFileButton, "disabled", () => view.previewLoading || view.applyLoading),
          attr(cancelButton, "disabled", () => view.applyLoading),
          attr(applyButton, "disabled", () => !view.preview || view.previewLoading || view.applyLoading),
        );

        onMountElements({
          backdrop,
          dialog,
          body,
          closeButton,
          chooseFileButton,
          cancelButton,
          applyButton,
        });
      },
    })
  );

  return renderDialog`
    <div class="modal-backdrop" role="presentation" data-ref="backdrop">
      <div
        class="modal import-merge-dialog"
        data-focus-zone="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-merge-title"
        tabindex="-1"
        data-ref="dialog"
      >
        <div class="modal__body import-merge-dialog__body" data-ref="body">
          <div class="import-merge-dialog__header">
            <div>
              <h2 id="import-merge-title" class="import-merge-dialog__title">Import and Merge</h2>
              <p class="import-merge-dialog__subtitle">
                Review additive changes before updating the current bookmark file.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              aria-label="Close import merge dialog"
              data-ref="closeButton"
            >
              x
            </button>
          </div>
          <div class="import-merge-dialog__file-bar">
            <div class="import-merge-dialog__file-meta">
              <div class="import-merge-dialog__file-label">Import file</div>
              <div class="import-merge-dialog__file-value" data-ref="filePath"></div>
            </div>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              data-keyboard-action="import-choose-file"
              data-ref="chooseFileButton"
            >
              Choose File
            </button>
          </div>
          ${errorComponent}
        </div>
        <div class="modal__footer">
          <button
            type="button"
            class="btn btn-ghost"
            data-keyboard-action="import-cancel"
            data-ref="cancelButton"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            data-keyboard-action="import-apply"
            data-ref="applyButton"
          >
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * @param {{ container: HTMLElement }} shell
 * @returns {{ cleanup: () => void }}
 */
export function mountImportMergeDialog(shell) {
  /** @type {(() => void) | undefined} */
  let cleanupRendered;

  const stop = effect(() => {
    cleanupRendered?.();
    cleanupRendered = undefined;
    shell.container.replaceChildren();

    if (!importMergeState.selectors.isImportMergeOpen()) {
      return;
    }

    const importPath = importMergeState.selectors.getImportMergePath();
    const preview = importMergeState.selectors.getImportMergePreview();
    const previewLoading = importMergeState.selectors.isImportMergePreviewLoading();
    const applyLoading = importMergeState.selectors.isImportMergeApplyLoading();
    const error = importMergeState.selectors.getImportMergeError();

    /** @type {ImportMergeDialogElements | undefined} */
    let elements;
    const component = createImportMergeDialog(
      { importPath, preview, previewLoading, applyLoading, error },
      (mountedElements) => {
        elements = mountedElements;
      },
    );

    mount(component, shell.container);

    if (!elements) {
      throw new Error("Expected import merge dialog elements after mount");
    }

    const previewCleanup = mountImportMergePreview(elements.body, preview, previewLoading);
    const interactionCleanup = bindImportMergeDialogInteractions(elements, {
      preview,
      previewLoading,
      applyLoading,
    });

    cleanupRendered = () => {
      interactionCleanup();
      previewCleanup();
      component.unmount?.();
      shell.container.replaceChildren();
    };
  });

  return {
    cleanup() {
      cleanupRendered?.();
      stop();
    },
  };
}
