// @ts-check

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
export function isEditableTarget(target) {
  /**
   * @param {Element | null} element
   * @returns {boolean}
   */
  function isEditableElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (element.isContentEditable) {
      return true;
    }
    const tagName = element.tagName.toLowerCase();
    return tagName === "input" || tagName === "textarea" || tagName === "select";
  }

  if (target instanceof HTMLElement) {
    if (isEditableElement(target)) {
      return true;
    }
    if (isEditableElement(target.closest("input, textarea, select, [contenteditable]"))) {
      return true;
    }
  }

  return isEditableElement(document.activeElement);
}

/**
 * @returns {"search" | "tree" | "detail" | "dialog"}
 */
export function getCurrentFocusZone() {
  const activeElement = document.activeElement;
  const zoneElement =
    activeElement instanceof HTMLElement
      ? activeElement.closest("[data-focus-zone]")
      : null;
  const zone = zoneElement?.getAttribute("data-focus-zone");
  if (zone === "search" || zone === "tree" || zone === "detail" || zone === "dialog") {
    return zone;
  }
  return "tree";
}

/** @returns {void} */
export function focusDetail() {
  const detail = document.querySelector('[data-focus-zone="detail"]');
  if (detail instanceof HTMLElement) {
    detail.focus();
  }
}

/** @returns {Promise<void>} */
export async function focusDetailForSelection() {
  await Promise.resolve();
  focusDetail();
}

/**
 * @param {string} action
 * @returns {boolean}
 */
export function clickKeyboardAction(action) {
  const target = document.querySelector(`[data-keyboard-action="${action}"]`);
  if (!(target instanceof HTMLElement) || target.hasAttribute("disabled")) {
    return false;
  }
  target.click();
  return true;
}
