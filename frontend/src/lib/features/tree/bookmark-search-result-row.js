// @ts-check

import { $, effect } from "../../naf-html.js";
import { treeState } from "../../state/tree/tree-state.js";

/**
 * @param {HTMLElement} el
 * @param {() => import("../../types.js").BookmarkIndexEntry} item
 * @returns {() => void}
 */
export function mountBookmarkSearchResultRow(el, item) {
  const row = el instanceof HTMLElement && el.matches(".search-result")
    ? el
    : $(".search-result", el);
  const label = $(".search-result__label", el);
  const meta = $(".search-result__meta", el);
  const icon = $(".search-result__icon", el);

  if (!(row instanceof HTMLElement)) {
    throw new Error("Expected .search-result row");
  }

  const handleClick = () => {
    treeState.actions.expandAncestors(item().nodeId);
    treeState.actions.selectSingle(item().nodeId);
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
