# Pain Point 7: querySelector inside list() setup

## Problem

`list()` row templates define `data-ref` attributes, but `list()` does not collect them.
Three modules currently use `el.querySelector('[data-ref="..."]')` inside their `list()`
setup callbacks to find row elements. This defeats the purpose of `data-ref` -- the
attribute is defined but never used by `list()`. It is only functional for `template()`
components that go through `collectRefs()`.

Affected files (14 querySelector calls total across 3 modules):
- `features/move/move-dialog.js` -- 4 per row (toggle, folderIcon, name, path)
- `components/toast/toast-container.js` -- 3 per row (alertWrapper, icon, message)
- `features/import-merge/import-merge-dialog-preview.js` -- 4 per section row + 2 per preview row

The tree row modules (`bookmark-tree-row.js`, `bookmark-search-result-row.js`) use
`children[0]`, `children[1]`, etc. This is faster but fragile -- any template change
breaks the indices.

## Solution

Add `collectRowRefs(el)` to NAF runtime. It takes a row element and returns a
`Record<string, Element>` map of all `data-ref` elements within that row.

This is consistent with the existing `collectRefs()` internal function and the
`requireRef()` pattern already used in template onMount callbacks.

## Tasks

### Task 1: Add `collectRowRefs()` to NAF runtime

**File:** `frontend/src/shared/runtime/naf.js`

Add the following exported function after `collectRefs()`:

```js
/**
 * Collect data-ref elements from a row element.
 *
 * Use this inside list() setup callbacks to replace querySelector calls
 * with a single refs map lookup. Similar to what template() does internally
 * via collectRefs(), but scoped to a single row element.
 *
 * Example:
 *   list(container, ROW_HTML, items, key, (el, item) => {
 *     const refs = collectRowRefs(el);
 *     const label = refs.label;
 *     const icon = refs.icon;
 *     // ...
 *   });
 *
 * @param {Element} el
 * @returns {Record<string, Element>}
 */
export function collectRowRefs(el) {
  /** @type {Record<string, Element>} */
  const refs = {};

  const name = el.getAttribute("data-ref");
  if (name) {
    refs[name] = el;
  }

  for (const child of el.querySelectorAll("[data-ref]")) {
    const childName = child.getAttribute("data-ref");
    if (childName) {
      refs[childName] = child;
    }
  }

  return refs;
}
```

**Verification:** `cd frontend && npm run typecheck`

---

### Task 2: Migrate move-dialog.js

**File:** `frontend/src/features/move/move-dialog.js`

**Step 2a: Add `data-ref="row"` to the row template.**

In `MOVE_FOLDER_ROW_HTML` (line 37), change:
```html
<div class="move-dialog__tree-row tree-row menu-item" role="treeitem" tabindex="-1" aria-selected="false">
```
To:
```html
<div class="move-dialog__tree-row tree-row menu-item" role="treeitem" tabindex="-1" aria-selected="false" data-ref="row">
```

**Step 2b: Replace querySelector calls with collectRowRefs.**

**Current code (lines 332-336):**
```js
const row = el.querySelector(".move-dialog__tree-row");
const toggle = el.querySelector('[data-ref="toggle"]');
const folderIcon = el.querySelector('[data-ref="folderIcon"]');
const name = el.querySelector('[data-ref="name"]');
const path = el.querySelector('[data-ref="path"]');
```

**Replace with:**
```js
const refs = collectRowRefs(el);
const row = /** @type {HTMLElement} */ (refs.row);
const toggle = /** @type {HTMLButtonElement} */ (refs.toggle);
const folderIcon = /** @type {HTMLElement} */ (refs.folderIcon);
const name = /** @type {HTMLElement} */ (refs.name);
const path = /** @type {HTMLElement} */ (refs.path);
```

Add `collectRowRefs` to the NAF import. Remove the instanceof checks for refs
that come from `collectRowRefs` (they are guaranteed to exist if the template
has the `data-ref`). Keep the row/toggle instanceof checks for safety.

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 3: Migrate toast-container.js

**File:** `frontend/src/components/toast/toast-container.js`

**Current code (lines 152-154):**
```js
const alertWrapper = el.querySelector('[data-ref="alert-wrapper"]');
const icon = el.querySelector('[data-ref="icon"]');
const message = el.querySelector('[data-ref="message"]');
```

**Replace with:**
```js
const refs = collectRowRefs(el);
const alertWrapper = /** @type {HTMLElement} */ (refs["alert-wrapper"]);
const icon = /** @type {HTMLElement} */ (refs.icon);
const message = /** @type {HTMLElement} */ (refs.message);
```

Add `collectRowRefs` to the NAF import.

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 4: Migrate import-merge-dialog-preview.js

**File:** `frontend/src/features/import-merge/import-merge-dialog-preview.js`

Two list() calls need migration:

**Section row setup (lines 141-144):**
```js
const titleEl = el.querySelector('[data-ref="title"]');
const badgeEl = el.querySelector('[data-ref="badge"]');
const emptyEl = el.querySelector('[data-ref="empty"]');
const rowsEl = el.querySelector('[data-ref="rows"]');
```

**Replace with:**
```js
const refs = collectRowRefs(el);
const titleEl = /** @type {HTMLElement} */ (refs.title);
const badgeEl = /** @type {HTMLElement} */ (refs.badge);
const emptyEl = /** @type {HTMLElement} */ (refs.empty);
const rowsEl = /** @type {HTMLElement} */ (refs.rows);
```

**Preview row setup (lines 177-178):**
```js
const rowTitle = rowEl.querySelector('[data-ref="title"]');
const rowSubtitle = rowEl.querySelector('[data-ref="subtitle"]');
```

**Replace with:**
```js
const rowRefs = collectRowRefs(rowEl);
const rowTitle = /** @type {HTMLElement} */ (rowRefs.title);
const rowSubtitle = /** @type {HTMLElement} */ (rowRefs.subtitle);
```

Add `collectRowRefs` to the NAF import.

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 5: Update NAF usage guidelines

**File:** `docs/naf-html-usage-guidelines.md`

Add a section under "Helper Guide" for `collectRowRefs()`:

```
### `collectRowRefs(el)`

Collect `data-ref` elements from a list row element.

Use inside `list()` setup callbacks to replace `querySelector('[data-ref="..."]')`
calls with a single refs map lookup:

```js
// Instead of:
const label = el.querySelector('[data-ref="label"]');
const icon = el.querySelector('[data-ref="icon"]');

// Write:
const refs = collectRowRefs(el);
const label = refs.label;
const icon = refs.icon;
```

Good uses:
- list() setup callbacks that need multiple row elements
- replacing querySelector calls inside list rows

Prefer `collectRowRefs()` over `querySelector('[data-ref="..."]')` inside list
setup callbacks. The `data-ref` attribute in list row templates is functional
when used with `collectRowRefs()`.

Prefer `children[0]`, `children[1]` direct access only when:
- the template structure is fixed and controlled by the same module
- performance is critical (e.g., thousands of tree rows)
- the module documents the child indices in a code comment
```

Also update the `list()` section to mention `collectRowRefs()`:

```
### `list(container, templateEl, items, key, setup)`

Use for keyed repeated UI with stable identity.

Inside the setup callback, use `collectRowRefs(el)` to access `data-ref`
elements defined in the row template, or use direct child access
(`el.children[0]`) when the template structure is fixed.
```

---

### Task 6: Consider migrating tree rows (optional, low priority)

**Files:**
- `frontend/src/features/tree/view/bookmark-tree-row.js`
- `frontend/src/features/tree/view/bookmark-search-result-row.js`

These modules use `children[0]`, `children[1]`, etc. with documented template
structure comments. This is a valid pattern for performance-critical tree
rendering. Migration to `collectRowRefs()` would be a correctness improvement
but adds a small performance cost (querySelectorAll per row).

**Decision:** Leave as-is for now. The template structure comments serve as
documentation, and the performance benefit of direct child access matters for
tree rows that may number in the thousands.

---

## Expected Outcome

- 14 `querySelector('[data-ref="..."]')` calls replaced with `collectRowRefs()`
- `data-ref` in list row templates becomes functional, not just a naming convention
- Consistent pattern across all list() usage: `collectRowRefs()` for ref-based
  access, `children[N]` for performance-critical fixed templates
- NAF runtime grows by ~20 lines (one small helper)
- No behavioral changes -- purely mechanical migration
