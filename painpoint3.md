# Pain Point 3: onMount Validation Boilerplate

## Problem

Every template component does exhaustive `instanceof` checks before accessing refs.
Each check is 3 lines:

```js
if (!(titleHeading instanceof HTMLHeadingElement)) {
  throw new Error("Expected bookmark detail title heading");
}
```

Current scope:
- 138 `instanceof` checks across 26 files
- ~414 lines of boilerplate (3 lines per check)
- Worst offenders:
  - bookmark-detail.js: 22 checks (66 lines)
  - move-dialog.js: 14 checks (42 lines)
  - folder-detail.js: 12 checks (36 lines)
  - add-bookmark-form.js: 10 checks (30 lines)
  - import-merge-dialog.js: 9 checks (27 lines)

Three patterns exist (not all are candidates for requireRef):
1. **Template refs** (ctx.refs inside onMount) - 11 files, ~96 checks -- PRIMARY TARGET
2. **Shell collection** (querySelector + instanceof in collectShell) - 8 files, ~16 checks -- SECONDARY TARGET
3. **Runtime guards** (conditional checks, not validation throws) - 7 files, ~26 checks -- NOT CANDIDATES

Pattern 3 files (NOT candidates -- these are runtime type guards, not validation):
- bookmark-search-result-row.js: guards on function parameters
- bookmark-tree-keyboard.js: `isEditableTarget()` returns false, doesn't throw
- global-shortcuts-focus.js: focus management type guards
- import-merge-dialog-preview.js: DOM traversal guards in list setup
- toast-container.js: toast rendering guards
- bookmark-tree-row.js: row rendering guards
- bookmark-tree.js (partial): DOM event target guards

## Solution

Add `requireRef()` helper to NAF runtime. Single-line replacement for the 3-line pattern:

```js
// Before:
const titleHeading = ctx.refs.titleHeading;
if (!(titleHeading instanceof HTMLHeadingElement)) {
  throw new Error("Expected bookmark detail title heading");
}

// After:
const titleHeading = requireRef(ctx.refs, "titleHeading");
```

API design:

```js
/**
 * @param {Record<string, Element>} refs
 * @param {string} name
 * @returns {Element}
 */
export function requireRef(refs, name) { ... }
```

Key decisions:
- No optional type parameter. In a single-app context where we control templates,
  the existence check is the meaningful validation. Type narrowing is handled by
  JSDoc annotations on the consuming code.
- Returns `Element` (not a generic type) to keep the API simple.
- Error message includes the ref name for debugging.

Expected reduction: ~360 lines -> ~120 lines (67% reduction in validation boilerplate).
- Phase 2 (template onMount): 12 files, ~106 checks, ~318 lines -> ~106 lines
- Phase 3 (shell collection): 8 files, ~14 checks, ~42 lines -> ~14 lines
- Non-candidates (runtime guards + NAF internal): ~18 checks, unchanged

## Tasks

### Phase 1: Add requireRef() to NAF runtime

#### Task 1.1: Implement requireRef() in naf.js
- Add `requireRef(refs, name)` function after `cleanupCollector()`
- Include JSDoc with `@template`, `@param`, `@returns` annotations
- Error message format: `"Missing required ref: {name}"`
- File: `frontend/src/shared/runtime/naf.js`

#### Task 1.2: Update NAF usage guidelines
- Document `requireRef()` in `docs/naf-html-usage-guidelines.md`
- Show the before/after pattern
- Place it in the "Helper Guide" section near `data-ref` documentation
- File: `docs/naf-html-usage-guidelines.md`

### Phase 2: Migrate template ref validations (onMount)

These are the mechanical replacements inside `onMount` callbacks where refs come
from `ctx.refs`. Each file replaces the 3-line validation block with a single
`requireRef()` call.

#### Task 2.1: Migrate bookmark-detail.js (22 checks)
- Replace 22 instanceof blocks with `requireRef(ctx.refs, "...")` calls
- File: `frontend/src/features/detail/view/bookmark-detail.js`

#### Task 2.2: Migrate move-dialog.js (14 checks)
- File: `frontend/src/features/move/move-dialog.js`

#### Task 2.3: Migrate folder-detail.js (12 checks)
- File: `frontend/src/features/detail/view/folder-detail.js`

#### Task 2.4: Migrate add-bookmark-form.js (10 checks)
- File: `frontend/src/features/editing/add-bookmark-form.js`

#### Task 2.5: Migrate import-merge-dialog.js (9 checks)
- File: `frontend/src/features/import-merge/import-merge-dialog.js`

#### Task 2.6: Migrate confirm-modal.js (8 checks)
- File: `frontend/src/components/confirm-modal/confirm-modal.js`

#### Task 2.7: Migrate add-folder-form.js (8 checks)
- File: `frontend/src/features/editing/add-folder-form.js`

#### Task 2.8: Migrate bulk-selection-detail.js (6 checks)
- File: `frontend/src/features/detail/view/bulk-selection-detail.js`

#### Task 2.9: Migrate empty-library-page.js (5 checks)
- File: `frontend/src/pages/empty-library/empty-library-page.js`

#### Task 2.10: Migrate titlebar.js (4 checks in onMount)
- File: `frontend/src/components/titlebar/titlebar.js`
- Note: Only the 4 checks inside onMount. The collectShell check is in Phase 3.

#### Task 2.11: Migrate toolbar-actions.js (4 checks)
- File: `frontend/src/components/toolbar/toolbar-actions.js`

#### Task 2.12: Migrate keyboard-shortcuts-dialog.js (4 checks)
- File: `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js`

#### Task 2.13: Skip non-candidate patterns
- Files with runtime guards (not validation throws):
  - bookmark-search-result-row.js, bookmark-tree-keyboard.js, global-shortcuts-focus.js,
    import-merge-dialog-preview.js, toast-container.js, bookmark-tree-row.js
- Files with collectShell validation (Phase 3, not Phase 2):
  - bookmark-tree.js, detail-panel.js, search-bar.js, page-frame.js
- NAF internal: `frontend/src/shared/runtime/naf.js` has 5 internal validation checks
  that are runtime assertions and should NOT be changed.
- List setup callbacks: Checks inside `list()` setup functions (e.g., bookmark-tree.js
  lines 133, 150) validate elements from the list renderer. These use a different pattern
  and are NOT candidates for `requireRef()`.

### Phase 3: Migrate shell collection functions

These use `querySelector` + instanceof in `collectShell` functions.
The pattern is slightly different (ref comes from DOM query, not ctx.refs),
but the validation goal is the same.

For these, the pattern becomes:
```js
// Before:
const titlebar = root.querySelector("#titlebar");
if (!(titlebar instanceof HTMLElement)) {
  throw new Error("Expected #titlebar element");
}

// After:
const titlebar = /** @type {HTMLElement} */ (root.querySelector("#titlebar"));
requireRef({ titlebar }, "titlebar");
// Or simply:
const titlebar = requireElement(root, "#titlebar", "titlebar");
```

Actually, for shell collection, a better helper might be:

```js
/**
 * @template {Element} T
 * @param {ParentNode} root
 * @param {string} selector
 * @param {string} description
 * @returns {T}
 */
export function requireElement(root, selector, description) {
  const el = root.querySelector(selector);
  if (!el) {
    throw new Error(`Missing required element: ${description} (${selector})`);
  }
  return /** @type {T} */ (el);
}
```

#### Task 3.1: Add requireElement() to NAF runtime
- Add `requireElement(root, selector, description)` helper
- Includes JSDoc with template type for type narrowing
- Error message includes both description and selector
- File: `frontend/src/shared/runtime/naf.js`

#### Task 3.2: Update guidelines for requireElement()
- Document in `docs/naf-html-usage-guidelines.md`
- File: `docs/naf-html-usage-guidelines.md`

#### Task 3.3: Migrate app-shell-layout.js (3 checks)
- File: `frontend/src/layouts/app-shell/app-shell-layout.js`

#### Task 3.4: Migrate bookmark-tree.js (3 checks in collectShell)
- File: `frontend/src/features/tree/view/bookmark-tree.js`
- Note: Only the 3 checks in collectBookmarkTreeShell (lines 72, 75, 78).
  The 2 checks inside list() setup callbacks (lines 133, 150) validate elements
  from the list renderer and are NOT candidates -- they use a different pattern.

#### Task 3.5: Migrate create-app.js (2 checks)
- File: `frontend/src/app/create-app.js`

#### Task 3.6: Migrate detail-panel.js (2 checks)
- File: `frontend/src/features/detail/view/detail-panel.js`

#### Task 3.7: Migrate bookmark-tree-dnd.js (1 check in collectShell)
- File: `frontend/src/features/tree/interactions/bookmark-tree-dnd.js`
- Note: Only the validation check in collectShell. The check at line 310 is
  a compound guard (`if (!(target instanceof HTMLElement) || target.closest("button"))`)
  that is not a simple validation throw.

#### Task 3.8: Migrate titlebar.js (1 check in collectShell)
- File: `frontend/src/components/titlebar/titlebar.js`
- Note: The collectTitlebarShell function has 1 validation check (line 244).
  The 4 checks in onMount (lines 97, 100, 103, 106) are in Phase 2.

#### Task 3.9: Migrate search-bar.js (1 check)
- File: `frontend/src/features/search/view/search-bar.js`

#### Task 3.10: Migrate page-frame.js (1 check)
- File: `frontend/src/pages/page-frame.js`

#### Task 3.11: Skip non-candidate shell files
- `global-shortcuts-focus.js` - runtime guards in focus management
- `toast-container.js` - runtime guards in toast rendering
- `import-merge-dialog-preview.js` - DOM traversal guards in list setup
- `bookmark-tree-row.js` - row rendering guards
- `bookmark-tree-keyboard.js` - runtime guard in isEditableTarget()

### Phase 4: Verify

#### Task 4.1: Run typecheck and build
```bash
cd frontend
npm run typecheck
npm run build
```
- Verify no new type errors
- Verify build succeeds

#### Task 4.2: Update analysis.md
- Mark pain point 3 as addressed
- Note the `requireRef()` and `requireElement()` additions to NAF
- File: `analysis.md`

## Migration Pattern

For each file in Phase 2:

1. Add `requireRef` to the import from naf.js
2. Replace the validation block at the top of onMount:

   Before:
   ```js
   const titleHeading = ctx.refs.titleHeading;
   const titleInput = ctx.refs.titleInput;
   const editButton = ctx.refs.editButton;

   if (!(titleHeading instanceof HTMLHeadingElement)) {
     throw new Error("Expected bookmark detail title heading");
   }
   if (!(titleInput instanceof HTMLInputElement)) {
     throw new Error("Expected bookmark detail title input");
   }
   if (!(editButton instanceof HTMLButtonElement)) {
     throw new Error("Expected bookmark detail edit button");
   }
   ```

   After:
   ```js
   const titleHeading = requireRef(ctx.refs, "titleHeading");
   const titleInput = requireRef(ctx.refs, "titleInput");
   const editButton = requireRef(ctx.refs, "editButton");
   ```

3. Remove the now-unused variables that were only assigned for validation
   (where the variable was reassigned after validation, e.g., `const titleInputEl = titleInput;`)

For each file in Phase 3:

1. Add `requireElement` to the import from naf.js
2. Replace querySelector + instanceof:

   Before:
   ```js
   const titlebar = root.querySelector("#titlebar");
   if (!(titlebar instanceof HTMLElement)) {
     throw new Error("Expected #titlebar element");
   }
   ```

   After:
   ```js
   const titlebar = requireElement(root, "#titlebar", "titlebar");
   ```

## Risk Assessment

- **Low risk**: This is a mechanical replacement. The behavior is identical
  (throw on missing element), just more concise.
- **Type safety**: `requireRef()` returns `Element`, not the specific subtype.
  Callers that need type narrowing should use JSDoc type assertions. This is
  acceptable because the template defines the element type, and we control
  both sides of the contract.
- **Error messages**: Slightly less descriptive (ref name vs. full description),
  but still actionable for debugging.
