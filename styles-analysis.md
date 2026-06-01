# Styles Analysis

## Overview

- 29 CSS files, 1,970 lines total
- 271 CSS rules across the codebase
- 97 defined CSS custom properties, 66 used, 31 unused
- 4 hardcoded rgba values in button.css that should be themed
- 4 hardcoded rgba values in tree-list.css that should be themed
- 1 hardcoded rgba in move-dialog.css that should be themed

---

## What Works Well

### 1. Token-driven theming

The token system is well-designed. `tokens.css` defines the dark theme (default) and `themes/light.css` overrides everything for light mode. The token naming is consistent (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`). Theme switching is a single attribute change on the root element.

### 2. Primitive/component separation

Primitives (`button.css`, `form.css`, `modal.css`, `card.css`, `alert.css`, `badge.css`, `spinner.css`, `menu.css`, `icon-mask.css`) are genuinely reusable and well-scoped. Components and features compose these primitives rather than reinventing them.

### 3. BEM naming is consistent

Every module uses BEM-style naming (`block__element`, `block--modifier`). No class name collisions. Predictable and scannable.

### 4. CSS is colocated with modules

Each feature/component has its own CSS file. No giant global stylesheet. This makes ownership clear and changes localized.

### 5. The icon-mask system is elegant

Single `icon-mask` primitive + CSS mask-image tokens + per-icon `--icon-size` overrides. No SVG sprinkled in HTML, no icon font, no sprite sheets. Clean.

### 6. Minimal media queries

Only 4 media queries, all for the same breakpoint (900px). No cascade of responsive breakpoints. Appropriate for a desktop app.

### 7. No !important abuse

Only 2 uses of `!important`: one in reset.css (standard) and one in tree-list.css for `cursor: grabbing !important` during drag. Justified.

---

## Issues and Opportunities

### 1. UNUSED TOKENS (31 of 97)

**32% of defined tokens are never used.** This is token sprawl.

Tokens defined in `tokens.css` but never referenced via `var()`:

- `--color-accent`, `--color-accent-content` -- brand colors, never used
- `--color-neutral`, `--color-neutral-content` -- neutral palette, never used
- `--color-surface-2`, `--color-surface-3` -- surface levels, never used
- `--color-icon-toggle` -- icon variant, never used
- `--color-selection-multi-bg`, `--color-selection-text` -- selection variants, never used
- `--color-alert-info-bg`, `--color-alert-info-border`, etc. -- alert backgrounds defined in tokens but alert.css uses `--color-info` directly
- `--space-1`, `--space-5`, `--space-6`, `--space-8` -- spacing tokens defined but `--space-2`, `--space-3`, `--space-4` are the only ones used
- `--btn-bg`, `--btn-border`, `--btn-fg`, `--btn-hover-bg`, `--btn-hover-border`, `--btn-shadow` -- button local vars that are set but never read as tokens
- `--icon-size` -- set on icon-mask elements but not referenced as a token
- `--folder`, `--bookmark`, `--edit`, `--move`, `--delete`, `--close`, `--with-plus` -- these are mask token suffixes, not standalone tokens

**Action:** Remove or document the unused tokens. For the alert-bg/border tokens: either use them in alert.css or remove them. For spacing: keep only `--space-2` through `--space-4` which are actually used.

### 2. HARDCODED RGBA VALUES (should be themed)

**button.css** has theme-specific hardcoded values:

```css
.btn-primary {
  --btn-border: rgba(37, 99, 235, 0.65);
  --btn-hover-bg: #1d4ed8;
}
[data-theme="light"] .btn-primary {
  --btn-border: rgba(37, 99, 235, 0.5);
}
.btn-secondary {
  --btn-border: rgba(255, 255, 255, 0.08);
  --btn-hover-bg: #3a4250;
}
[data-theme="light"] .btn-secondary {
  --btn-border: rgba(0, 0, 0, 0.12);
  --btn-hover-bg: #e2e8f0;
}
```

These should use tokens. The `[data-theme="light"]` override pattern in button.css is the only place outside `themes/` that does theme-specific styling. This creates a maintenance burden: every time a new theme is added, button.css needs updating.

**tree-list.css** has hardcoded rgba:

```css
.tree-row.is-primary {
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.28);
}
.tree-row.is-primary .tree-row__count,
.search-result.is-selected .search-result__meta {
  color: rgba(248, 250, 252, 0.78);
}
```

These are light-theme-specific values that will look wrong in dark mode. The `rgba(248, 250, 252, 0.78)` is a near-white color -- it works for dark mode but will be invisible on light backgrounds.

**move-dialog.css** has the same `rgba(248, 250, 252, 0.78)` for `.is-primary .move-dialog__tree-path`.

**Action:** Create tokens like `--color-primary-glow` and `--color-selected-muted` in the theme files. Replace all hardcoded rgba values with `var(--token)`.

### 3. DUPLICATE DECLARATION BLOCKS

Four declaration blocks appear 3+ times across the codebase:

**`color: var(--color-muted); font-size: 0.8125rem;`** (3x)
- Used in multiple subtitle/caption contexts

**`display: grid; gap: 1rem;`** (3x)
- Generic grid layout, used in multiple features

**`display: grid; gap: 0.875rem; padding: 0.875rem 1rem; border: var(--border) solid var(--color-border-quiet); border-radius: 0.375rem; background: var(--color-surface-1);`** (3x)
- This is the "panel" pattern in detail-surface.css. Used by `.folder-detail__header`, `.folder-detail__edit`, `.bookmark-detail__header`, `.bookmark-detail__notes`, `.bulk-selection-detail__header`, `.bulk-selection-detail__footer`

**`display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;`** (3x)
- Header row pattern

**Action:** The panel pattern (3rd one) is the biggest opportunity. Create a `.panel` primitive:

```css
.panel {
  display: grid;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: var(--border) solid var(--color-border-quiet);
  border-radius: 0.375rem;
  background: var(--color-surface-1);
}
```

This would replace 6 separate declaration blocks in detail-surface.css.

The muted text pattern could become `.text-muted` or `.caption`:
```css
.caption {
  color: var(--color-muted);
  font-size: 0.8125rem;
}
```

### 4. EYEBROW/LABEL PATTERN DUPLICATION

The "eyebrow" pattern (small uppercase text with letter-spacing) appears in 6 files:

```css
/* In shell-panel.css */
.shell-panel__eyebrow {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* In form.css */
.label {
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* In badge.css */
.badge {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* In detail-surface.css */
.bulk-selection-detail__eyebrow {
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* In import-merge-dialog.css */
.import-merge-dialog__file-label {
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* In move-dialog.css */
.move-dialog__list-header {
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
```

Three different letter-spacing values (0.06em, 0.08em, 0.14em) and two font sizes (0.6875rem, 0.75rem). This is the same pattern with minor variations.

**Action:** Create a `.eyebrow` primitive and pick one letter-spacing value. The variations are noise, not design intent.

### 5. SECTION HEADER / ROW BORDER PATTERN DUPLICATION

The "section header" pattern (padding + bottom border) appears in 4 files:

```css
.shortcuts-dialog__section-header {
  padding: 0.875rem 1rem;
  border-bottom: var(--border) solid var(--color-border-faint);
}
.import-merge-dialog__section-header {
  padding: 0.875rem 1rem;
  border-bottom: var(--border) solid var(--color-border-faint);
}
.move-dialog__filter-shell {
  padding: 0.5rem;
  border-bottom: var(--border) solid var(--color-border-faint);
}
.shell-panel__header {
  padding: 0.75rem 0.875rem 0.65rem;
  border-bottom: var(--border) solid var(--color-border-faint);
}
```

And the "row:first-child { border-top: 0 }" pattern appears in 2 files.

**Action:** These are close enough to be a `.section-header` primitive, but the padding values differ slightly. Consider standardizing the padding or accepting the variation as intentional.

### 6. FONT SIZE FRAGMENTATION

13 distinct font sizes in non-theme files:
- 0.6875rem (4x) -- eyebrow/labels
- 0.7rem (1x) -- tree counts
- 0.75rem (10x) -- subtitles, metadata
- 0.78rem (1x) -- titlebar buttons
- 0.8rem (1x) -- empty state subtitle
- 0.8125rem (5x) -- body text
- 0.875rem (12x) -- body/caption text
- 0.9rem (1x) -- tree rows
- 0.9375rem (3x) -- section titles
- 0.95rem (4x) -- headings
- 1rem (4x) -- titles
- 1.25rem (2x) -- dialog titles
- 1.5rem (1x) -- stat values

This is 13 sizes for a single-window desktop app. The 0.6875/0.7/0.75/0.78/0.8 cluster is especially noisy -- these are all "small text" but with 5 different values.

**Action:** Consolidate to 6-7 sizes:
- 0.75rem -- eyebrow/captions (replace 0.6875, 0.7, 0.78, 0.8)
- 0.8125rem -- body text
- 0.875rem -- large body/subtitles
- 0.95rem -- headings
- 1rem -- titles
- 1.25rem -- dialog titles
- 1.5rem -- stat values

### 7. PADDING FRAGMENTATION

The most common padding is `0.875rem 1rem` (13x occurrences). This is the "panel padding" pattern. Other common values:
- `0.75rem 0.875rem` (4x) -- header padding
- `0.5rem` (2x) -- tight padding
- `0.35rem 0.625rem` (2x) -- badge/kbd padding

**Action:** Define padding tokens for the common patterns:
```css
--padding-panel: 0.875rem 1rem;
--padding-header: 0.75rem 0.875rem;
--padding-tight: 0.5rem;
```

### 8. MASK-IMAGE DUPLICATION

`mask-image: var(--mask-folder)` is declared 6 times and `mask-image: var(--mask-bookmark)` is declared 6 times. This is because each icon class re-declares the mask:

```css
.tree-row__folder-icon::before {
  mask-image: var(--mask-folder);
  -webkit-mask-image: var(--mask-folder);
}
.detail-action-icon--folder::before {
  mask-image: var(--mask-folder);
  -webkit-mask-image: var(--mask-folder);
}
```

This is not technically duplication -- each selector needs its own declaration. But the `-webkit-mask-image` prefix is repeated every time. Modern browsers (2024+) don't need the `-webkit-` prefix for mask-image.

**Action:** Remove `-webkit-mask-image` declarations. They add ~14 lines of dead code.

### 9. SPINNER ABSOLUTE POSITIONING DUPLICATION

The "spinner inside input" pattern is declared twice in detail-surface.css:

```css
.add-bookmark-panel__spinner {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  transform: translateY(-50%);
}
.bookmark-detail__spinner {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  transform: translateY(-50%);
}
```

**Action:** Create a utility: `.spinner-input { position: absolute; top: 50%; right: 0.75rem; transform: translateY(-50%); }`

### 10. DETAIL-SURFACE.CSS IS TOO LARGE

52 rules, 327 lines. It owns:
- Add folder/bookmark launcher panels
- Detail inline actions
- Detail action icons (6 mask declarations)
- Bookmark detail surface
- Folder detail surface
- Bulk selection detail surface
- Detail empty state

The detail action icons section alone is 6 rules for mask-image declarations. These could move to `icon-mask.css` as part of the icon system.

**Action:** Extract detail action icon masks to `icon-mask.css` or a new `detail-icons.css` file.

### 11. TREE-LIST.CSS MIXES CONCERNS

28 rules that cover:
- Tree node/row styling
- DnD visual states
- Folder/bookmark icons
- Search result rows
- Empty state
- Selected state styling with hardcoded rgba

The DnD states (`is-drop-before`, `is-drop-after`, `is-drop-inside`, `is-drag-source`) are interaction-specific and could be separated.

**Action:** Consider splitting into `tree-row.css` (structure), `tree-dnd.css` (interaction states), and `tree-icons.css` (icon masks).

### 12. DARK THEME IS THE DEFAULT BUT LIGHT IS THE DOCUMENTED ONE

`tokens.css` defines the dark theme as `:root`. `themes/light.css` overrides everything with `[data-theme="light"]`. But the app starts with `data-theme="light"` in index.html. This means the dark theme values are defined but never seen unless the user switches.

This is not a bug, but it means the dark theme is the "source of truth" and light is the override. If you add a third theme, it also needs to override everything. Consider whether this direction makes sense or if light should be the base.

### 13. THEME FILES ARE ASYMMETRIC

`themes/light.css` has 112 lines of overrides. `themes/dark.css` has 3 lines:

```css
[data-theme="dark"] {
  color-scheme: dark;
}
```

This is because dark is the `:root` default. The asymmetry means adding a third theme requires copying the entire light.css structure. If light becomes the default, dark.css would need the same treatment.

### 14. BUTTON LOCAL VARIABLES ARE NEVER READ AS TOKENS

The button.css file defines local CSS variables:

```css
.btn-primary {
  --btn-bg: var(--color-primary);
  --btn-fg: var(--color-primary-content);
  --btn-border: rgba(37, 99, 235, 0.65);
  --btn-hover-bg: #1d4ed8;
}
```

These are used internally by `.btn` via `var(--btn-bg, transparent)`, etc. They are NOT referenced as standalone tokens anywhere. This is fine -- it's a local scoping pattern. But they show up in the "unused tokens" count because the regex doesn't distinguish between local and global variables.

**Action:** Document this pattern or prefix local vars differently (e.g., `--_btn-bg`) to distinguish them from global tokens.

### 15. NO CSS LINTING OR BUILD STEP

The CSS is imported directly via `@import` in `app.css`. No PostCSS, no autoprefixer, no linting. This means:
- No detection of unused CSS
- No detection of duplicate declarations
- No enforcement of token usage
- No minification

For a 1,970-line codebase this is manageable, but it will become harder as the app grows.

**Action:** Consider adding stylelint with rules for:
- No hardcoded colors (require `var(--color-*)`)
- No duplicate declaration blocks
- Consistent font-size values

---

## Consolidation Opportunities (Priority Order)

### High Impact

1. **Create `.panel` primitive** -- replaces 6 declaration blocks in detail-surface.css
2. **Create `.eyebrow` primitive** -- replaces 6 near-identical blocks across 6 files
3. **Move hardcoded rgba to theme tokens** -- 9 hardcoded values across 3 files
4. **Remove `-webkit-mask-image`** -- 14 lines of dead prefix code

### Medium Impact

5. **Consolidate font sizes** -- reduce from 13 to 7 distinct sizes
6. **Create `.caption` / `.text-muted` utility** -- replaces 3+ declaration blocks
7. **Extract detail action icons** -- move 6 mask rules from detail-surface.css to icon-mask.css
8. **Create `.spinner-input` utility** -- replaces 2 identical blocks

### Low Impact

9. **Remove unused tokens** -- 31 tokens never referenced
10. **Document button local variable pattern** -- clarify `--btn-*` are scoped, not global
11. **Add stylelint** -- prevent future sprawl

---

## Estimated Reduction

| Change | Lines Saved |
|--------|-------------|
| `.panel` primitive | ~20 lines |
| `.eyebrow` primitive | ~18 lines |
| Remove `-webkit-mask-image` | ~14 lines |
| Hardcoded rgba -> tokens | ~9 lines |
| `.spinner-input` utility | ~6 lines |
| Font size consolidation | ~5 lines |
| Remove unused tokens | ~30 lines (from tokens.css) |
| **Total** | **~102 lines (~5% of total)** |

The percentage is small because the codebase is already lean. The real value is in maintainability: fewer places to update when changing a theme, fewer patterns to remember, and automated enforcement of consistency.
