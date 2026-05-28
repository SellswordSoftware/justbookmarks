// @ts-check

import { $, fx } from "../../../shared/runtime/naf-html.js";
import { treeState } from "../../state/tree/tree-state.js";
import { uiState } from "../../state/ui-state.js";

/**
 * @typedef {import("../../types.js").VisibleTreeNodeEntry} VisibleTreeNodeEntry
 */

/**
 * @typedef {object} TreeNodeMountOptions
 * @property {(entry: VisibleTreeNodeEntry, event: MouseEvent) => void} onPointerDown
 * @property {() => boolean} shouldIgnoreClick
 */

/**
 * @param {VisibleTreeNodeEntry["node"]} node
 * @returns {boolean}
 */
function isFolderNode(node) {
  return node.type === 0;
}

/**
 * @param {VisibleTreeNodeEntry["node"]} node
 * @returns {string}
 */
function getNodeLabel(node) {
  if (isFolderNode(node)) {
    return node.folder.name || "Untitled folder";
  }
  return node.bookmark.title || node.bookmark.url || "Untitled bookmark";
}

/**
 * @param {HTMLElement} el
 * @param {() => VisibleTreeNodeEntry} entry
 * @param {TreeNodeMountOptions} options
 * @returns {() => void}
 */
export function mountBookmarkTreeRow(el, entry, options) {
  const row = $(".tree-row", el);
  const toggle = $(".tree-row__toggle", el);
  const folderIcon = $(".tree-row__folder-icon", el);
  const bookmarkIcon = $(".tree-row__bookmark-icon", el);
  const favicon = /** @type {HTMLImageElement | null} */ (
    $(".tree-row__favicon", el)
  );
  const label = $(".tree-row__label", el);
  const count = $(".tree-row__count", el);

  if (!(row instanceof HTMLElement)) {
    throw new Error("Expected .tree-row element");
  }

  /** @param {MouseEvent} event */
  const handleToggleClick = (event) => {
    event.stopPropagation();
    const current = entry();
    if (isFolderNode(current.node)) {
      treeState.actions.toggleExpand(current.id);
    }
  };

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  const handleRowClick = (event) => {
    if (options.shouldIgnoreClick()) {
      return;
    }

    const current = entry();

    if (event.shiftKey) {
      const changed = treeState.actions.selectRange(
        current.id,
        treeState.selectors.getVisibleNodeIds(),
      );
      if (!changed) {
        uiState.actions.showToast(
          "Range selection must stay within the same sibling group",
          "warning",
        );
      }
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      const changed = treeState.actions.toggleSelected(current.id);
      if (!changed) {
        uiState.actions.showToast(
          "Multi-select only supports matching sibling bookmarks or folders",
          "warning",
        );
      }
      return;
    }

    treeState.actions.selectSingle(current.id);
  };

  /** @param {MouseEvent} event */
  const handlePointerDown = (event) => {
    options.onPointerDown(entry(), event);
  };

  toggle?.addEventListener("click", handleToggleClick);
  row.addEventListener("click", handleRowClick);
  row.addEventListener("mousedown", handlePointerDown);

  const stop = fx(row, (currentRow) => {
    const current = entry();
    const node = current.node;
    const folder = isFolderNode(node);
    const expanded = folder
      ? treeState.selectors.isExpanded(current.id)
      : false;
    const selected = treeState.selectors.isSelected(current.id);
    const primary = treeState.selectors.getSelectedNodeId() === current.id;

    currentRow.dataset.nodeId = current.id;
    currentRow.dataset.nodeType = folder ? "folder" : "bookmark";
    currentRow.style.paddingLeft = `${current.depth * 16 + (folder ? 8 : 28)}px`;
    currentRow.classList.toggle("is-selected", selected);
    currentRow.classList.toggle("is-primary", primary);
    currentRow.setAttribute("aria-selected", selected ? "true" : "false");
    currentRow.setAttribute(
      "aria-expanded",
      folder ? String(expanded) : "false",
    );

    if (label) {
      label.textContent = getNodeLabel(node);
    }

    if (toggle instanceof HTMLElement) {
      toggle.hidden = !folder;
      toggle.setAttribute("aria-hidden", folder ? "false" : "true");
      toggle.textContent = expanded ? "⌄" : "›";
    }

    if (folderIcon instanceof HTMLElement) {
      folderIcon.hidden = !folder;
      folderIcon.classList.toggle("is-open", expanded);
    }

    if (bookmarkIcon instanceof HTMLElement) {
      bookmarkIcon.hidden = folder || Boolean(!folder && node.bookmark.icon);
    }

    if (count instanceof HTMLElement) {
      count.hidden = !folder;
      count.textContent = folder ? `(${node.folder.children.length})` : "";
    }

    if (favicon) {
      const icon = !folder ? node.bookmark.icon : "";
      favicon.hidden = folder || !icon;
      if (icon) {
        favicon.src = icon;
      } else {
        favicon.removeAttribute("src");
      }
    }
  });

  return () => {
    stop();
    toggle?.removeEventListener("click", handleToggleClick);
    row.removeEventListener("click", handleRowClick);
    row.removeEventListener("mousedown", handlePointerDown);
  };
}
