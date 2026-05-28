// @ts-check

import { computed, signal } from "../../shared/runtime/naf-html.js";

/**
 * Search state owner.
 *
 * Owns:
 * - search query
 * - flat bookmark index
 * - derived filtered results
 */

/** @typedef {import("../../types.js").BookmarkIndexEntry} BookmarkIndexEntry */

const query = signal("");
const flatIndex = signal(/** @type {BookmarkIndexEntry[]} */ ([]));

const results = computed(() => {
  const currentQuery = query();
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
};
