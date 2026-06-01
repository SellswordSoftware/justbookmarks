# Icon System Analysis

## Current State

### Mask-image system (7 icons)

Defined in `tokens.css` as CSS custom properties:
- `--mask-folder` (319 chars)
- `--mask-folder-open` (505 chars)
- `--mask-bookmark` (332 chars)
- `--mask-edit` (448 chars)
- `--mask-move` (880 chars)
- `--mask-trash` (717 chars)
- `--mask-plus` (159 chars)

Total: ~3,460 chars of SVG data URIs in tokens.css

### Icon usage in JS templates (22 occurrences)

| Icon class | Files |
|------------|-------|
| `icon-mask` (base) | bookmark-tree.js, folder-detail.js, bookmark-detail.js, move-dialog.js |
| `tree-row__folder-icon` | bookmark-tree.js, move-dialog.js |
| `tree-row__bookmark-icon` | bookmark-tree.js |
| `search-result__icon` | bookmark-tree.js |
| `detail-action-icon--edit` | folder-detail.js, bookmark-detail.js |
| `detail-action-icon--move` | folder-detail.js, bookmark-detail.js |
| `detail-action-icon--delete` | folder-detail.js, bookmark-detail.js |
| `detail-action-icon--bookmark` | bookmark-detail.js |
| `bookmark-detail__icon-fallback-icon` | bookmark-detail.js |

### Mask-image declarations in CSS (22 occurrences)

Each CSS file that uses an icon re-declares the mask-image:

| File | Icons declared |
|------|----------------|
| `tokens.css` | 7 (source of truth) |
| `tree-list.css` | 4 (--mask-folder x2, --mask-bookmark x2, --mask-folder-open x2) |
| `tree-pane.css` | 4 (--mask-folder x2, --mask-bookmark x2, --mask-plus x2) |
| `detail-surface.css` | 6 (--mask-edit x2, --mask-move x2, --mask-trash x2, --mask-bookmark x2, --mask-folder x2, --mask-plus x2) |

### Inline SVGs (4 icons, toast only)

In `toast-container.js`:
- INFO_SVG (244 chars) - info circle icon
- SUCCESS_SVG (227 chars) - check circle icon
- WARNING_SVG (314 chars) - warning triangle icon
- ERROR_SVG (250 chars) - error X circle icon

Total: ~1,035 chars of inline SVGs

### Total icon footprint

- Mask-image tokens: ~3,460 chars (defined once, referenced 22x)
- Inline SVGs: ~1,035 chars (defined once, used dynamically)
- CSS mask declarations: ~14 lines of duplicate `-webkit-mask-image` prefixes
- **Total: ~4,500 chars**

---

## Problems

### 1. Toast icons are a separate system

Toast uses inline SVGs while everything else uses CSS mask-image. This means:
- Different rendering approach (inline SVG vs CSS mask)
- Different styling (toast icons use stroke, mask icons use fill)
- Can't reuse toast icons elsewhere without converting
- Can't reuse mask icons in toasts without converting

### 2. Mask-image declarations are duplicated

Each CSS file that uses an icon re-declares the mask-image property. For example, `--mask-folder` is declared in tokens.css, then re-declared in tree-list.css, tree-pane.css, and detail-surface.css.

This is not technically wrong (the token is defined once, the property is set multiple times), but it means:
- Adding a new icon requires updating multiple CSS files
- Removing an icon requires updating multiple CSS files
- The icon-mask.css primitive file is empty of actual icons

### 3. Icon classes are scattered

Icon classes are defined in multiple CSS files:
- `tree-list.css`: `.tree-row__folder-icon`, `.tree-row__bookmark-icon`, `.search-result__icon`
- `tree-pane.css`: `.tree-row__toggle--add`, `.tree-row__toggle--fetch`
- `detail-surface.css`: `.detail-action-icon--edit`, `.detail-action-icon--move`, `.detail-action-icon--delete`, `.detail-action-icon--bookmark`, `.detail-action-icon--folder`

### 4. Each icon usage requires two classes

```html
<span class="icon-mask detail-action-icon--edit"></span>
```

The `icon-mask` class provides the base styling and `::before` pseudo-element. The `detail-action-icon--edit` class sets the specific `mask-image`. This is fine but verbose.

### 5. No icon registry or documentation

There is no single place that lists all available icons. To find an icon, you need to search for `--mask-` in tokens.css.

---

## Consolidation Options

### Option A: Centralize mask-image declarations in icon-mask.css

Move all mask-image declarations from feature CSS files into `icon-mask.css`:

```css
/* icon-mask.css */
.icon-mask {
  position: relative;
  display: block;
  width: var(--icon-size, 0.95rem);
  height: var(--icon-size, 0.95rem);
}

.icon-mask::before {
  content: "";
  position: absolute;
  inset: 0;
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

/* Icon modifiers */
.icon--folder::before {
  mask-image: var(--mask-folder);
}

.icon--folder-open::before {
  mask-image: var(--mask-folder-open);
}

.icon--bookmark::before {
  mask-image: var(--mask-bookmark);
}

.icon--edit::before {
  mask-image: var(--mask-edit);
}

.icon--move::before {
  mask-image: var(--mask-move);
}

.icon--trash::before {
  mask-image: var(--mask-trash);
}

.icon--plus::before {
  mask-image: var(--mask-plus);
}
```

Then in HTML templates, use:
```html
<span class="icon-mask icon--folder"></span>
<span class="icon-mask icon--edit"></span>
```

**Pros:**
- Single source of truth for icon-to-mask mapping
- Feature CSS files no longer need mask-image declarations
- Easy to add new icons (one file to update)
- Clear icon registry

**Cons:**
- Requires renaming all icon classes across the codebase
- Breaking change for existing CSS classes

### Option B: Convert toast icons to mask-image system

Add toast icons to tokens.css:

```css
--mask-info: url("data:image/svg+xml,...");
--mask-success: url("data:image/svg+xml,...");
--mask-warning: url("data:image/svg+xml,...");
--mask-error: url("data:image/svg+xml,...");
```

Then in toast-container.js, use the icon-mask system:

```js
const TOAST_ROW_HTML = /*html*/ `
  <article class="toast" data-template="toast">
    <div class="alert" data-ref="alert-wrapper">
      <span class="icon-mask" data-ref="icon"></span>
      <span data-ref="message"></span>
    </div>
  </article>
`;

function getToastIconClass(type) {
  switch (type) {
    case "success": return "icon--success";
    case "error": return "icon--error";
    case "warning": return "icon--warning";
    default: return "icon--info";
  }
}
```

**Pros:**
- Consistent icon system across the app
- No inline SVGs in JS
- Easier to style toast icons (inherit color, size, etc.)

**Cons:**
- Toast icons use stroke-based SVGs, mask icons use fill-based SVGs
- Need to convert toast SVGs to fill-based or accept mixed styles
- Slightly larger tokens.css

### Option C: SVG sprite sheet

Create a single SVG sprite file with all icons:

```svg
<!-- icons.svg -->
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="icon-folder" viewBox="0 0 24 24">
    <path d="..."/>
  </symbol>
  <symbol id="icon-bookmark" viewBox="0 0 24 24">
    <path d="..."/>
  </symbol>
  <!-- etc -->
</svg>
```

Then reference icons in HTML:
```html
<svg class="icon"><use href="icons.svg#icon-folder"/></svg>
```

**Pros:**
- Single file for all icons
- Easy to add/remove icons
- Can be cached by browser
- Supports multiple colors per icon

**Cons:**
- Requires loading an external file (or inlining the sprite)
- Different rendering approach than current mask-image system
- More complex setup
- Not compatible with current icon-mask CSS

### Option D: Keep current system, just clean up

1. Remove `-webkit-mask-image` prefixes (modern browsers don't need them)
2. Document available icons in a comment block in tokens.css
3. Leave everything else as-is

**Pros:**
- No breaking changes
- Minimal effort
- Current system works fine

**Cons:**
- Doesn't address the fragmentation
- Toast icons remain a separate system
- No central icon registry

---

## Recommendation

**Combine Option A and Option B:**

1. **Centralize mask-image declarations in icon-mask.css** with a consistent naming convention (`icon--name`)
2. **Convert toast icons to the mask-image system** by adding them to tokens.css
3. **Remove `-webkit-mask-image` prefixes** (dead code)
4. **Add an icon registry comment** in icon-mask.css

This gives you:
- Single source of truth for all icons
- Consistent rendering across the app
- No inline SVGs in JS
- Clear documentation
- Easy to add new icons

### Implementation steps

1. **Update icon-mask.css:**
   - Add all icon modifier classes (`icon--folder`, `icon--edit`, etc.)
   - Remove `-webkit-mask-image` prefixes
   - Add icon registry comment

2. **Update tokens.css:**
   - Add toast icon masks (`--mask-info`, `--mask-success`, etc.)
   - Keep existing mask tokens

3. **Update feature CSS files:**
   - Remove mask-image declarations from tree-list.css, tree-pane.css, detail-surface.css
   - Keep structural/icon-specific styling (sizes, colors, etc.)

4. **Update JS templates:**
   - Change icon classes from `detail-action-icon--edit` to `icon-mask icon--edit`
   - Change toast icons from inline SVG to icon-mask classes

5. **Update HTML templates:**
   - Change `class="icon-mask detail-action-icon--edit"` to `class="icon-mask icon--edit"`
   - Change `class="tree-row__folder-icon icon-mask"` to `class="icon-mask icon--folder"`

### Estimated impact

- Lines saved: ~30 (duplicate mask declarations + webkit prefixes)
- Files changed: ~10 (icon-mask.css, tokens.css, 3 feature CSS files, 4 JS files)
- New icons: 4 (toast icons)
- Total icons: 11 (7 existing + 4 toast)
