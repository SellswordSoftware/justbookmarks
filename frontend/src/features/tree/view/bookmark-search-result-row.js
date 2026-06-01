// @ts-check

import { effect } from "../../../shared/runtime/naf.js";
import { treeState } from "../state/tree-state.js";

/**
 * Mount a search result row. Uses direct child access -- the template
 * structure is fixed and controlled by this module.
 *
 * Template structure (SEARCH_RESULT_HTML in bookmark-tree.js):
 *   <article class="search-result">       <-- el
 *     <span class="search-result__icon">   <-- children[0] (icon)
 *     <span class="search-result__label">  <-- children[1] (label)
 *     <span class="search-result__meta">   <-- children[2] (meta)
 *   </article>
 *
 * @param {HTMLElement} el
 * @param {() => BookmarkIndexEntry} item
 * @returns {() => void}
 */
export function mountBookmarkSearchResultRow(el, item) {
  // el IS the <article class="search-result"> element
  const row = el;

  // Direct child access -- see template structure comment above
  const icon = /** @type {HTMLElement} */ (row.children[0]);
  const label = /** @type {HTMLElement} */ (row.children[1]);
  const meta = /** @type {HTMLElement} */ (row.children[2]);

  if (!(row instanceof HTMLElement)) {
    throw new Error("Expected .search-result row");
  }

  const handleClick = () => {
    void treeState.actions.revealAndSelectNode(item().nodeId);
  };

  row.addEventListener("click", handleClick);

  const stop = effect(() => {
    const current = item();
    const selected = treeState.selectors.getSelectedNodeId() === current.nodeId;

    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
    if (label) {
      label.textContent = current.title || current.url;
    }
    if (meta) {
      meta.textContent = current.folderPath;
    }
    if (icon instanceof HTMLElement) {
      icon.classList.add("is-bookmark");
    }
  });

  return () => {
    stop();
    row.removeEventListener("click", handleClick);
  };
}
