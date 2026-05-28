// @ts-check

import { ApplyImportMerge, OpenImportFilePicker, PreviewImportMerge } from "../api.js";
import { getErrorMessage } from "../errors.js";
import { signal } from "../naf-html.js";
import { treeState } from "./tree-state.js";
import { uiState } from "./ui-state.js";

/** @typedef {import("../../types.js").MergePreview} MergePreview */

const importMergeOpen = signal(false);
const importMergePath = signal("");
const importMergePreview = signal(/** @type {MergePreview | null} */ (null));
const importMergePreviewLoading = signal(false);
const importMergeApplyLoading = signal(false);
const importMergeError = signal("");

export const importMergeState = {
  signals: {
    importMergeOpen,
    importMergePath,
    importMergePreview,
    importMergePreviewLoading,
    importMergeApplyLoading,
    importMergeError,
  },
  computed: {},
  actions: {
    /**
     * @param {boolean} [force=false]
     * @returns {boolean}
     */
    closeImportMergeDialog(force = false) {
      if (importMergeApplyLoading() && !force) {
        return false;
      }

      importMergeOpen(false);
      importMergePath("");
      importMergePreview(null);
      importMergePreviewLoading(false);
      importMergeError("");
      return true;
    },
    /**
     * @param {string} path
     * @returns {Promise<void>}
     */
    async previewImportMergeFromPath(path) {
      importMergeOpen(true);
      importMergePath(path);
      importMergePreview(null);
      importMergeError("");
      importMergePreviewLoading(true);

      try {
        const preview = await PreviewImportMerge(path);
        const hasAdditions =
          preview.foldersToAdd.length > 0 || preview.bookmarksToAdd.length > 0;

        if (!hasAdditions) {
          importMergeState.actions.closeImportMergeDialog(true);
          uiState.actions.showToast("No new changes found", "info");
          return;
        }

        importMergePreview(preview);
      } catch (caughtError) {
        importMergeError(
          getErrorMessage(caughtError, "Failed to preview import merge"),
        );
      } finally {
        importMergePreviewLoading(false);
      }
    },
    /**
     * @returns {Promise<void>}
     */
    async openImportMerge() {
      const path = await OpenImportFilePicker();
      if (!path) {
        return;
      }

      await importMergeState.actions.previewImportMergeFromPath(path);
    },
    /**
     * @returns {Promise<void>}
     */
    async pickAnotherImportFile() {
      const path = await OpenImportFilePicker();
      if (!path) {
        return;
      }

      await importMergeState.actions.previewImportMergeFromPath(path);
    },
    /**
     * @returns {Promise<void>}
     */
    async applyImportMerge() {
      const path = importMergePath();
      if (!path) {
        return;
      }

      importMergeApplyLoading(true);
      importMergeError("");

      try {
        const result = await ApplyImportMerge(path);
        await treeState.actions.refresh();
        importMergeState.actions.closeImportMergeDialog(true);
        uiState.actions.showToast(
          `Merge applied: ${result.foldersAdded} folders, ${result.bookmarksAdded} bookmarks`,
          "success",
        );
      } catch (caughtError) {
        importMergeError(
          getErrorMessage(caughtError, "Failed to apply import merge"),
        );
      } finally {
        importMergeApplyLoading(false);
      }
    },
  },
  selectors: {
    /**
     * @returns {boolean}
     */
    isImportMergeOpen() {
      return importMergeOpen();
    },
    /**
     * @returns {string}
     */
    getImportMergePath() {
      return importMergePath();
    },
    /**
     * @returns {MergePreview | null}
     */
    getImportMergePreview() {
      return importMergePreview();
    },
    /**
     * @returns {boolean}
     */
    isImportMergePreviewLoading() {
      return importMergePreviewLoading();
    },
    /**
     * @returns {boolean}
     */
    isImportMergeApplyLoading() {
      return importMergeApplyLoading();
    },
    /**
     * @returns {string}
     */
    getImportMergeError() {
      return importMergeError();
    },
  },
};
