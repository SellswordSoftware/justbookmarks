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

const query = signal("", { label: "search.query" });
const flatIndex = signal(/** @type {BookmarkIndexEntry[]} */ ([]), { label: "search.flatIndex" });

/**
 * Debounced query signal. Updates ~150ms after the last keystroke.
 * The `results` computed reads from this to avoid O(n) filter on every
 * character typed.
 */
const _debouncedQuery = signal("", { label: "search.debouncedQuery" });

/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimer = null;

/**
 * Timer functions for debouncing. Defaults to real setTimeout/clearTimeout.
 * Tests can override these via `setTimerFactory()` to avoid real delays.
 *
 * @type {(fn: () => void, delay: number) => ReturnType<typeof setTimeout>}
 */
let _scheduleTimer = setTimeout;

/** @type {(id: ReturnType<typeof setTimeout>) => void} */
let _cancelTimer = clearTimeout;

/**
 * Override the timer functions used by the debounce effect.
 * Intended for tests that need to avoid real delays.
 *
 * @param {(fn: () => void, delay: number) => ReturnType<typeof setTimeout>} scheduleFn
 * @param {(id: ReturnType<typeof setTimeout>) => void} cancelFn
 * @returns {void}
 */
export function setSearchStateTimerFactory(scheduleFn, cancelFn) {
  _scheduleTimer = scheduleFn;
  _cancelTimer = cancelFn;
}

/**
 * Schedule a debounced update to `_debouncedQuery`.
 * Called by an effect that tracks `query`.
 *
 * @param {string} nextQuery
 * @returns {void}
 */
function scheduleDebouncedQuery(nextQuery) {
  if (debounceTimer !== null) {
    _cancelTimer(debounceTimer);
  }
  debounceTimer = _scheduleTimer(() => {
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
}, { label: "search.results" });

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
}, { label: "search.debounceEffect" });

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
