// @ts-check

import { FetchFavicon, FetchPageTitle } from "../../../shared/api/api.js";

/**
 * @param {string} value
 * @returns {boolean}
 */
export function canFetchMetadata(value) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {object} options
 * @param {() => boolean} options.isEditing
 * @param {() => string} options.getCurrentURL
 * @param {() => string} options.getCurrentTitle
 * @param {() => string} options.getCurrentIcon
 * @param {(value: string) => void} options.setCurrentTitle
 * @param {(value: string) => void} options.setCurrentIcon
 * @param {(value: boolean) => void} options.setFetchingTitle
 * @param {(message: string) => void} options.setDetailError
 * @returns {{
 *   resetTracking: (title: string, icon: string) => void,
 *   clearScheduledFetch: () => void,
 *   cancelOutstandingFetches: () => void,
 *   scheduleMetadataFetch: () => void
 * }}
 */
export function createBookmarkMetadataWorkflow(options) {
  let lastAutoTitle = "";
  let lastAutoIcon = "";
  let fetchSequence = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let fetchTimer = null;

  /**
   * @param {string} title
   * @param {string} icon
   * @returns {void}
   */
  function resetTracking(title, icon) {
    lastAutoTitle = title;
    lastAutoIcon = icon;
  }

  /** @returns {void} */
  function clearScheduledFetch() {
    if (fetchTimer !== null) {
      clearTimeout(fetchTimer);
      fetchTimer = null;
    }
  }

  /** @returns {void} */
  function cancelOutstandingFetches() {
    clearScheduledFetch();
    fetchSequence += 1;
    options.setFetchingTitle(false);
  }

  /** @returns {void} */
  function scheduleMetadataFetch() {
    clearScheduledFetch();
    options.setFetchingTitle(false);

    if (!options.isEditing() || !canFetchMetadata(options.getCurrentURL())) {
      fetchSequence += 1;
      return;
    }

    const requestId = ++fetchSequence;
    fetchTimer = setTimeout(async () => {
      fetchTimer = null;
      options.setFetchingTitle(true);
      options.setDetailError("");
      try {
        const url = options.getCurrentURL().trim();
        const [titleResult, faviconResult] = await Promise.allSettled([
          FetchPageTitle(url),
          FetchFavicon(url),
        ]);
        if (requestId !== fetchSequence) {
          return;
        }

        if (titleResult.status === "fulfilled" && titleResult.value) {
          if (!options.getCurrentTitle().trim() || options.getCurrentTitle() === lastAutoTitle) {
            options.setCurrentTitle(titleResult.value);
            lastAutoTitle = titleResult.value;
          }
        }

        if (faviconResult.status === "fulfilled" && faviconResult.value) {
          if (!options.getCurrentIcon() || options.getCurrentIcon() === lastAutoIcon) {
            options.setCurrentIcon(faviconResult.value);
            lastAutoIcon = faviconResult.value;
          }
        }
      } catch {
        // Metadata autofill is best effort only.
      } finally {
        if (requestId === fetchSequence) {
          options.setFetchingTitle(false);
        }
      }
    }, 800);
  }

  return {
    resetTracking,
    clearScheduledFetch,
    cancelOutstandingFetches,
    scheduleMetadataFetch,
  };
}
