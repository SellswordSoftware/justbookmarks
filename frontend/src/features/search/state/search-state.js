// @ts-check

import { computed, effect, signal } from "../../../shared/runtime/naf.js";

/**
 * Search state owner.
 *
 * Owns:
 * - search query
 * - flat bookmark index
 * - derived filtered results
 */

const query = signal("");
const flatIndex = signal(/** @type {BookmarkIndexEntry[]} */ ([]));

/**
 * Debounced query signal. Updates ~150ms after the last keystroke.
 * The `results` computed reads from this to avoid O(n) filter on every
 * character typed.
 */
const _debouncedQuery = signal("");

/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimer = null;

/**
 * Schedule a debounced update to `_debouncedQuery`.
 * Called by an effect that tracks `query`.
 *
 * @param {string} nextQuery
 * @returns {void}
 */
function scheduleDebouncedQuery(nextQuery) {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    _debouncedQuery(nextQuery);
    debounceTimer = null;
  }, 150);
}

const results = computed(() => {
  const currentQuery = _debouncedQuery();
  if (!currentQuery.trim()) {
    return /** @type {BookmarkIndexEntry[]} */ ([]);
  }

  const normalizedQuery = currentQuery.toLowerCase();
  return flatIndex().filter(
    (entry) =>
      entry.title.toLowerCase().includes(normalizedQuery) ||
      entry.url.toLowerCase().includes(normalizedQuery),
  );
});

/**
 * @param {string} nodeId
 * @param {BookmarkPatch} patch
 * @returns {void}
 */
function patchBookmarkIndexEntry(nodeId, patch) {
  if (patch.title === undefined && patch.url === undefined) {
    return;
  }

  let changed = false;
  const nextIndex = flatIndex().map((entry) => {
    if (entry.nodeId !== nodeId) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      title: patch.title ?? entry.title,
      url: patch.url ?? entry.url,
    };
  });

  if (changed) {
    flatIndex(nextIndex);
  }
}

/**
 * @param {BookmarkIndexEntry} entry
 * @returns {void}
 */
function addBookmarkIndexEntry(entry) {
  if (!entry.nodeId) {
    return;
  }
  const existingIndex = flatIndex().findIndex((current) => current.nodeId === entry.nodeId);
  if (existingIndex >= 0) {
    const nextIndex = [...flatIndex()];
    nextIndex[existingIndex] = entry;
    flatIndex(nextIndex);
    return;
  }
  flatIndex([...flatIndex(), entry]);
}

/**
 * @param {string} nodeId
 * @param {string} folderPath
 * @returns {void}
 */
function patchBookmarkFolderPathEntry(nodeId, folderPath) {
  let changed = false;
  const nextIndex = flatIndex().map((entry) => {
    if (entry.nodeId !== nodeId) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      folderPath,
    };
  });

  if (changed) {
    flatIndex(nextIndex);
  }
}

/**
 * Effect that drives the debounced query. Subscribes to `query`
 * and schedules `_debouncedQuery` updates.
 */
const _debounceEffect = effect(() => {
  const nextQuery = query();
  scheduleDebouncedQuery(nextQuery);
});

export const searchState = {
  signals: {
    query,
    flatIndex,
  },
  computed: {
    results,
  },
  actions: {
    /**
     * @param {string} nextQuery
     * @returns {string}
     */
    setQuery(nextQuery) {
      return query(nextQuery);
    },
    /**
     * @param {BookmarkIndexEntry[]} index
     * @returns {BookmarkIndexEntry[]}
     */
    setIndex(index) {
      return flatIndex(index);
    },
    /**
     * @param {string} nodeId
     * @param {BookmarkPatch} patch
     * @returns {void}
     */
    patchBookmark(nodeId, patch) {
      patchBookmarkIndexEntry(nodeId, patch);
    },
    /**
     * @param {BookmarkIndexEntry} entry
     * @returns {void}
     */
    addBookmark(entry) {
      addBookmarkIndexEntry(entry);
    },
    /**
     * @param {string} nodeId
     * @param {string} folderPath
     * @returns {void}
     */
    patchBookmarkFolderPath(nodeId, folderPath) {
      patchBookmarkFolderPathEntry(nodeId, folderPath);
    },
    /**
     * @returns {string}
     */
    clearQuery() {
      return query("");
    },
  },
  selectors: {
    /**
     * @returns {string}
     */
    getQuery() {
      return query();
    },
    /**
     * @returns {BookmarkIndexEntry[]}
     */
    getIndex() {
      return flatIndex();
    },
    /**
     * @returns {BookmarkIndexEntry[]}
     */
    getResults() {
      return results();
    },
    /**
     * @returns {boolean}
     */
    isSearching() {
      return query().trim().length > 0;
    },
  },
  /**
   * Clean up timers and effects. Call during app teardown.
   * @returns {void}
   */
  dispose() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    _debounceEffect();
  },
};
