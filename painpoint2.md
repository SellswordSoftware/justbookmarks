# Pain Point 2: Hidden State Toggling Is Incredibly Verbose

## Problem Statement

50 `.hidden =` assignments across the codebase. Most are binary toggles based on a single signal (editing vs not editing, open vs closed, has-data vs no-data). Every one requires a full `fx()` wrapper with a callback that does nothing but set `.hidden`:

```js
// Current pattern (repeated ~50 times):
fx(titleInput, (currentTitleInput) => {
  currentTitleInput.hidden = !editing();
}),
fx(cancelButton, (currentCancelButton) => {
  currentCancelButton.hidden = !editing();
}),
// ... many more like this
```

This is mechanical repetition that obscures intent. The reader has to parse the `fx()` wrapper, the callback signature, and the negation logic to understand that "this element is shown when editing."

## Proposed Solution

Add `show()` and `hide()` helpers to NAF that express visibility intent directly:

```js
// After:
show(titleInput, editing),      // shown when editing() is truthy
show(cancelButton, editing),    // shown when editing() is truthy
hide(titleHeading, editing),    // hidden when editing() is truthy
hide(errorEl, () => errorMessage().length === 0),
```

### API Design

```js
/**
 * Show element when condition signal is truthy.
 * Reactive -- re-evaluates when condition changes.
 *
 * @template {Element} T
 * @param {T | null | undefined} el
 * @param {() => any} condition
 * @returns {() => void}
 */
export function show(el, condition) {
  if (!el) return () => {};
  return effect(() => { el.hidden = !condition(); });
}

/**
 * Hide element when condition signal is truthy.
 * Reactive -- re-evaluates when condition changes.
 *
 * @template {Element} T
 * @param {T | null | undefined} el
 * @param {() => any} condition
 * @returns {() => void}
 */
export function hide(el, condition) {
  if (!el) return () => {};
  return effect(() => { el.hidden = condition(); });
}
```

### Design Decisions

1. **Both `show()` and `hide()`** -- not just one with negation. `show(el, editing)` is more readable than `show(el, () => !editing())` and communicates intent directly.

2. **Accept signal functions directly** -- pass `editing` not `() => editing()`. The condition getter IS the signal, so calling it tracks the dependency. This avoids double-wrapping.

3. **Null-safe** -- returns no-op cleanup when element is missing, same as `fx()`.

4. **Returns cleanup function** -- works directly with `cleanupCollector()`, consistent with `fx()`, `listener()`, `model()`.

5. **NOT a replacement for `fx()`** -- `fx()` remains for cases where `.hidden` is set alongside other DOM properties (textContent, disabled, src, etc.). `show()`/`hide()` only target pure visibility toggles.

## Impact Analysis

### Classification of Current `.hidden` Usage

**Pure visibility-only `fx()` calls** -- can be replaced with `show()`/`hide()`:

| File | Count | Pattern |
|------|-------|---------|
| `features/detail/view/bookmark-detail.js` | 9 | editing-based toggles + fallbackIcon |
| `features/detail/view/folder-detail.js` | 2 | editing-based toggles |
| `features/editing/add-bookmark-form.js` | 1 | open-based toggle |
| `features/editing/add-folder-form.js` | 1 | open-based toggle |

**Mixed `fx()` calls** (hidden + other DOM ops) -- stay as `fx()`:

| File | Count | Additional operations |
|------|-------|----------------------|
| `features/detail/view/bookmark-detail.js` | 11 | textContent, disabled, src, aria-hidden |
| `features/tree/view/bookmark-tree-row.js` | 5 | classList, textContent, attributes |
| `features/move/move-dialog.js` | 1 | disabled, textContent, attributes |
| `features/detail/view/bulk-selection-detail.js` | 1 | disabled, textContent |

**Imperative `.hidden`** (not inside fx/effect) -- not reactive:

| File | Count | Reason |
|------|-------|--------|
| `pages/page-frame.js` | 8 | imperative shell panel toggling |
| `components/titlebar/titlebar.js` | 2 | inside effect but not fx |
| `features/detail/view/bookmark-detail.js` | 2 | conditional branch, not reactive |
| `features/import-merge/import-merge-dialog-preview.js` | 2 | inside effect, not fx |

### Expected Reduction

- **Conversions**: 13 `fx()` calls replaced with `show()`/`hide()`
- **Lines of code eliminated**: ~39 lines (3 lines per `fx()` call)
- **Readability improvement**: High -- `show(titleInput, editing)` is self-documenting

## Task Breakdown

### Task 1: Add `show()` and `hide()` to NAF runtime

**File**: `frontend/src/shared/runtime/naf.js`

Add two new exported functions after the existing `fx()` function (around line 239).

Include full JSDoc with `@template {Element} T`, parameter types, and return type.

**Verification**: `cd frontend && npm run typecheck && npm run build`

---

### Task 2: Update NAF usage guidelines

**File**: `docs/naf-html-usage-guidelines.md`

Two changes:

1. Update the "Runtime Surface" section to list `show()` and `hide()`.

2. Add a new "Helper Guide" subsection after `fx()`:

```markdown
### `show(el, condition)` / `hide(el, condition)`

Use for reactive visibility toggling when the only DOM operation is setting `.hidden`.

Good uses:
- showing/hiding elements based on a single signal (editing, open, loading)
- conditional visibility based on data state (hasDate, isEmpty, etc.)

Example:
```js
// Instead of:
fx(titleInput, (el) => { el.hidden = !editing(); }),
fx(cancelButton, (el) => { el.hidden = !editing(); }),

// Write:
show(titleInput, editing),
show(cancelButton, editing),
hide(titleHeading, editing),
```

Prefer `show()`/`hide()` over `fx()` when the callback only sets `.hidden`.
Keep `fx()` when the callback also sets other properties (textContent, disabled, etc.).

Prefer `show()` or `hide()` over negated conditions:
- `show(el, editing)` -- not `show(el, () => !editing())`
- `hide(el, editing)` -- communicates "hidden when editing" directly
```

**Verification**: No build impact -- documentation only.

---

### Task 3: Migrate `bookmark-detail.js`

**File**: `frontend/src/features/detail/view/bookmark-detail.js`

**Convert to show/hide** (9 calls):

```js
// Pure visibility-only fx() calls -> show/hide:
show(titleInput, editing),           // was: hidden = !editing()
show(urlInputWrap, editing),         // was: hidden = !editing()
show(cancelButton, editing),         // was: hidden = !editing()
hide(editButton, editing),           // was: hidden = editing()
hide(moveButton, editing),           // was: hidden = editing()
hide(deleteButton, editing),         // was: hidden = editing()
hide(actionRow, editing),            // was: hidden = editing()
show(notesInput, editing),           // was: hidden = !editing()
hide(fallbackIcon, currentIcon),     // was: hidden = Boolean(currentIcon())
```

**Keep as fx()** (11 calls -- mixed operations):

- `fx(titleHeading, ...)` -- also sets textContent
- `fx(urlLink, ...)` -- also sets textContent
- `fx(saveButton, ...)` -- also sets disabled (fetchingFavicon)
- `fx(titleLoading, ...)` -- also sets aria-hidden
- `fx(iconImage, ...)` -- also sets src (conditional branch)
- `fx(faviconButton, ...)` -- also sets disabled and textContent
- `fx(notesText, ...)` -- also sets textContent
- `fx(notesEmpty, ...)` -- compound condition with textContent
- `fx(detailsError, ...)` -- also sets textContent
- `fx(addedDate, ...)` -- also sets textContent; not reactive (static data)
- `fx(modifiedDate, ...)` -- also sets textContent; not reactive (static data)

**Import change**: Add `show, hide` to the naf.js import.

**Verification**: `cd frontend && npm run typecheck && npm run build`

---

### Task 4: Migrate `folder-detail.js`

**File**: `frontend/src/features/detail/view/folder-detail.js`

**Convert to show/hide** (2 calls):

```js
hide(header, editing),       // was: hidden = editing()
show(editPanel, editing),    // was: hidden = !editing()
```

**Keep as fx()** (5 calls -- mixed operations):

- `fx(title, ...)` -- sets textContent
- `fx(count, ...)` -- sets textContent
- `fx(created, ...)` -- sets textContent + hidden (textContent is static)
- `fx(saveButton, ...)` -- sets disabled
- `fx(nameError, ...)` -- sets textContent + hidden

**Import change**: Add `show, hide` to the naf.js import.

**Verification**: `cd frontend && npm run typecheck && npm run build`

---

### Task 5: Migrate `add-bookmark-form.js`

**File**: `frontend/src/features/editing/add-bookmark-form.js`

**Convert to show/hide** (1 call):

```js
show(panel, open),  // was: hidden = !open()
```

**Keep as fx()** (3 calls -- mixed operations):

- `fx(loading, ...)` -- sets hidden + aria-hidden
- `fx(error, ...)` -- sets hidden + textContent
- `fx(submit, ...)` -- sets disabled

**Import change**: Add `show, hide` to the naf.js import.

**Verification**: `cd frontend && npm run typecheck && npm run build`

---

### Task 6: Migrate `add-folder-form.js`

**File**: `frontend/src/features/editing/add-folder-form.js`

**Convert to show/hide** (1 call):

```js
show(panel, open),  // was: hidden = !open()
```

**Keep as fx()** (2 calls -- mixed operations):

- `fx(error, ...)` -- sets hidden + textContent
- `fx(submit, ...)` -- sets disabled

**Import change**: Add `show, hide` to the naf.js import.

**Verification**: `cd frontend && npm run typecheck && npm run build`

---

### Task 7: Final verification

Run the complete verification after all migrations:

```bash
cd frontend
npm run typecheck
npm run build
```

The `show()`/`hide()` helpers are functionally equivalent to the `fx()` calls they replace -- they create effects that track the same signal dependencies and set `.hidden` the same way. No behavioral change is expected.

## Summary of Changes

| Task | File | Conversions | Lines Saved |
|------|------|-------------|-------------|
| 1 | `naf.js` | New functions | +15 (new code) |
| 2 | `naf-html-usage-guidelines.md` | Documentation | +20 (docs) |
| 3 | `bookmark-detail.js` | 9 fx() -> show/hide | ~27 |
| 4 | `folder-detail.js` | 2 fx() -> show/hide | ~6 |
| 5 | `add-bookmark-form.js` | 1 fx() -> show/hide | ~3 |
| 6 | `add-folder-form.js` | 1 fx() -> show/hide | ~3 |
| **Total** | | **13 conversions** | **~39 lines saved** |

## What This Does NOT Address

The following patterns remain as `fx()` because they do multiple DOM operations in one callback:

1. **hidden + textContent** -- error messages that show/hide AND display text
2. **hidden + disabled** -- buttons that show/hide AND enable/disable
3. **hidden + attributes** -- toggle buttons that show/hide AND set aria-hidden
4. **hidden + src** -- images that show/hide AND update source
5. **Static hidden** -- elements hidden based on non-reactive data (dates, folder types)

For these cases, `fx()` is the right tool. The `show()`/`hide()` helpers target the most common pure-visibility pattern specifically.

## Future Enhancement (Out of Scope)

If the mixed-operation pattern becomes a pain point, consider a `classes()` helper for reactive class toggling:

```js
classes(row, () => ({
  "is-selected": selected,
  "is-expanded": expanded,
}));
```

This would address the pattern seen in `bookmark-tree-row.js` where `classList.toggle()` is called multiple times in one `fx()` callback. Not included in this plan because it is a separate concern from visibility toggling.
