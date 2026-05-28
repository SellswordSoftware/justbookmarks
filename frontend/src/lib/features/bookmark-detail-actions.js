// @ts-check

import {
  DeleteNode,
  FetchFavicon,
  OpenURL,
  UpdateBookmark,
} from "../api.js";
import { getErrorMessage } from "../errors.js";
import { moveDialogState } from "../state/move-dialog-state.js";
import { treeState } from "../state/tree-state.js";
import { uiState } from "../state/ui-state.js";

/**
 * @typedef {import("../../types.js").BookmarkNode} BookmarkNode
 */

/**
 * @param {object} options
 * @param {BookmarkNode} options.bookmark
 * @param {() => string} options.getCurrentTitle
 * @param {() => string} options.getCurrentURL
 * @param {() => string} options.getCurrentIcon
 * @param {() => string} options.getCurrentMeta
 * @param {(value: string) => void} options.setCurrentIcon
 * @param {(value: boolean) => void} options.setEditing
 * @param {(value: boolean) => void} options.setFetchingFavicon
 * @param {(message: string) => void} options.setDetailError
 * @param {() => void} options.focusInvalidURL
 * @param {(title: string, icon: string) => void} options.resetMetadataTracking
 * @returns {{
 *   saveBookmark: () => Promise<void>,
 *   fetchFaviconNow: () => Promise<void>,
 *   openInBrowser: () => Promise<void>,
 *   showDeleteConfirm: () => void,
 *   showMoveDialog: () => void
 * }}
 */
export function createBookmarkDetailActions(options) {
  const { bookmark } = options;

  /** @returns {Promise<void>} */
  async function saveBookmark() {
    if (!options.getCurrentURL().trim()) {
      options.setDetailError("URL is required");
      options.focusInvalidURL();
      return;
    }

    try {
      await UpdateBookmark(bookmark.id, {
        title: options.getCurrentTitle().trim(),
        url: options.getCurrentURL().trim(),
        icon: options.getCurrentIcon(),
        meta: options.getCurrentMeta().trim(),
      });
      options.resetMetadataTracking(options.getCurrentTitle(), options.getCurrentIcon());
      options.setEditing(false);
      await treeState.actions.refresh();
      treeState.actions.selectSingle(bookmark.id);
      uiState.actions.showToast("Bookmark updated", "success");
    } catch (caughtError) {
      options.setDetailError(getErrorMessage(caughtError, "Failed to update bookmark"));
    }
  }

  /** @returns {Promise<void>} */
  async function fetchFaviconNow() {
    if (!options.getCurrentURL().trim()) {
      return;
    }

    options.setFetchingFavicon(true);
    options.setDetailError("");
    try {
      const dataUri = await FetchFavicon(options.getCurrentURL().trim());
      if (dataUri) {
        options.setCurrentIcon(dataUri);
        options.resetMetadataTracking(options.getCurrentTitle(), dataUri);
        await UpdateBookmark(bookmark.id, { icon: dataUri });
        await treeState.actions.refresh();
        treeState.actions.selectSingle(bookmark.id);
        uiState.actions.showToast("Favicon fetched", "success");
      }
    } catch (caughtError) {
      const message = getErrorMessage(caughtError, "Failed to fetch favicon");
      options.setDetailError(message);
      uiState.actions.showToast(message, "error");
    } finally {
      options.setFetchingFavicon(false);
    }
  }

  /** @returns {Promise<void>} */
  async function openInBrowser() {
    try {
      await OpenURL(bookmark.bookmark.url);
    } catch (caughtError) {
      uiState.actions.showToast(`Failed to open URL: ${getErrorMessage(caughtError)}`, "error");
    }
  }

  /** @returns {void} */
  function showDeleteConfirm() {
    uiState.actions.showConfirm(
      "Delete Bookmark",
      `Delete "${bookmark.bookmark.title}"?`,
      "Delete",
      async () => {
        try {
          await DeleteNode(bookmark.id);
          treeState.actions.clearSelection();
          await treeState.actions.refresh();
          uiState.actions.showToast("Bookmark deleted", "success");
        } catch (caughtError) {
          uiState.actions.showToast(
            getErrorMessage(caughtError, "Failed to delete bookmark"),
            "error",
          );
        }
      },
    );
  }

  /** @returns {void} */
  function showMoveDialog() {
    moveDialogState.actions.showMoveDialog(
      bookmark.id,
      bookmark.bookmark.title || bookmark.bookmark.url,
      "bookmark",
      treeState.selectors.getTree(),
    );
  }

  return {
    saveBookmark,
    fetchFaviconNow,
    openInBrowser,
    showDeleteConfirm,
    showMoveDialog,
  };
}
