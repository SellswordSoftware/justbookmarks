# CSS System Refactor Plan

## Goal

Make the style system more usable, component-friendly, and maintainable without changing visual behavior.

## Principles

- No visual changes — behavior and appearance stay identical
- Each CSS file owns exactly one concern
- Global tokens are foundational only; component details stay local
- Primitives use a consistent modifier pattern (local CSS var overrides)
- Theme files override minimal base colors; derived values compute automatically

---

## Phase 1: Quick wins (bug fix + file cleanup)

### Task 1.1 — Fix alert primitive background bug

**File:** `frontend/src/styles/primitives/alert.css`

`.alert-info` sets `background: var(--color-info)` (raw color) instead of `background: var(--color-alert-info-bg)` (tinted variant). Same for success, warning, error.

```diff
 .alert-info {
-    background: var(--color-info);
+    background: var(--color-alert-info-bg);
     border-color: var(--color-alert-info-border);
     color: var(--color-info-content);
 }
```

Apply same fix to `.alert-success`, `.alert-warning`, `.alert-error`.

**Verification:** Visual check — alerts should render with tinted backgrounds, not solid colors.

---

### Task 1.2 — Split `shell-panel.css` into properly scoped files

**File:** `frontend/src/components/shell-panel/shell-panel.css`

Current contents and where they belong:

| Classes | Current file | Should be in |
|---|---|---|
| `.search-shell__label`, `.search-shell__input`, `#search-clear` | shell-panel.css | `features/search/` (new `search-shell.css`) |
| `.shell-panel`, `.shell-panel__header`, `.shell-panel__body`, `.shell-panel__eyebrow`, `.shell-panel__title`, `.shell-panel__subtitle` | shell-panel.css | shell-panel.css (keep) |
| `.resizer` | shell-panel.css | `styles/layout.css` (pane resize belongs with shell layout) |
| `.placeholder-card` | shell-panel.css | `styles/primitives/card.css` (it's a card variant) |
| `.detail-empty-state`, `.detail-empty-state__title`, `.detail-empty-state__subtitle` | shell-panel.css | `features/detail/styles/detail-surface.css` |

**Actions:**
1. Move `.resizer` rules to `styles/layout.css`
2. Move `.placeholder-card` to `styles/primitives/card.css`
3. Move `.detail-empty-state` rules to `features/detail/styles/detail-surface.css`
4. Move `.search-shell` / `#search-clear` rules to `features/search/styles/search-shell.css`
5. Leave only `.shell-panel` rules in `shell-panel.css`
6. Update `styles/app.css` barrel to import new files

**Verification:** `npm run build` — no style regression.

---

### Task 1.3 — Move `#toolbar-actions` ID selector out of `layout.css`

**File:** `frontend/src/styles/layout.css`

`#toolbar-actions` is a toolbar component concern, not a layout concern. Move it to `components/toolbar/toolbar.css`.

**Verification:** Visual check — toolbar actions render identically.

---

## Phase 2: Token scope cleanup

### Task 2.1 — Audit and remove component-specific tokens from global tokens

**File:** `frontend/src/styles/tokens.css` (and `themes/light.css`)

Tokens to remove from global scope (push to component CSS as local variables):

| Token | Component owner |
|---|---|
| `--color-btn-primary-border` | `primitives/button.css` |
| `--color-btn-primary-hover` | `primitives/button.css` |
| `--color-btn-secondary-border` | `primitives/button.css` |
| `--color-btn-secondary-hover` | `primitives/button.css` |
| `--color-tree-primary-inset` | `features/tree/styles/tree-list.css` |
| `--color-tree-primary-count` | `features/tree/styles/tree-list.css` |
| `--color-action-btn` | `features/tree/styles/tree-pane.css` |
| `--color-action-btn-hover` | `features/tree/styles/tree-pane.css` |
| `--color-titlebar-close-text` | `components/titlebar/titlebar.css` |
| `--color-icon-badge-bg` | `features/tree/styles/tree-pane.css` |
| `--color-icon-badge-icon` | `features/tree/styles/tree-pane.css` |
| `--color-selected-path-text` | `features/move/move-dialog.css` |
| `--color-tree-selected-bg` (light only) | `features/tree/styles/tree-list.css` |
| `--color-tree-selected-border` (light only) | `features/tree/styles/tree-list.css` |
| `--color-tree-primary-bg` (light only) | `features/tree/styles/tree-list.css` |
| `--color-tree-primary-text` (light only) | `features/tree/styles/tree-list.css` |
| `--color-tree-primary-icon` (light only) | `features/tree/styles/tree-list.css` |

**Actions:**
1. For each token, check all usages across the codebase
2. If used only within one component/feature, replace `var(--color-xxx)` with a local CSS variable defined in that component's CSS
3. Remove the global token from `tokens.css` and `themes/light.css`

**Verification:** `npm run build` — no style regression.

---

### Task 2.2 — Consolidate base palette naming

**File:** `frontend/src/styles/tokens.css` and `themes/light.css`

Currently both DaisyUI names (`base-100/200/300`) and semantic names (`surface-1/2/3`) coexist. Pick one approach and alias the other.

**Recommendation:** Keep `base-*` as the DaisyUI-compatible names (they're used by `color-scheme` and have broader ecosystem familiarity). Map `surface-*` to computed values from `base-*` where possible, or keep `surface-*` as explicit overrides only when they diverge.

**Actions:**
1. Audit all usages of `--color-base-*` vs `--color-surface-*`
2. Where `surface-*` is just a shade of `base-*`, replace with `base-*`
3. Where `surface-*` has a distinct purpose (transparency, gradients), keep it but document the distinction

**Verification:** Visual check — no color regression.

---

### Task 2.3 — Remove unused tokens

**File:** `frontend/src/styles/tokens.css`

Tokens with no CSS references:
- `--panel-gradient` — defined but never used
- `--color-overlay` — defined but never used
- `--color-base-300` — defined but never used
- `--color-secondary` / `--color-secondary-content` — check if used beyond `btn-secondary`

**Actions:** Search for each token reference. Remove if unused.

---

## Phase 3: Primitive modifier pattern

### Task 3.1 — Extend button modifier pattern to card

**File:** `frontend/src/styles/primitives/card.css`

Current:
```css
.card {
  border: var(--border) solid var(--color-border-quiet);
  border-radius: var(--radius-box);
  background: var(--color-surface-1);
}
```

Target:
```css
.card {
  border: var(--border) solid var(--card-border, var(--color-border-quiet));
  border-radius: var(--radius-box);
  background: var(--card-bg, var(--color-surface-1));
  color: var(--card-fg, inherit);
}

.card--warning {
  --card-bg: var(--color-alert-warning-bg);
  --card-border: var(--color-alert-warning-border);
}

.card--error {
  --card-bg: var(--color-alert-error-bg);
  --card-border: var(--color-alert-error-border);
}

.card--info {
  --card-bg: var(--color-alert-info-bg);
  --card-border: var(--color-alert-info-border);
}
```

**Verification:** Existing `.card` usage renders identically.

---

### Task 3.2 — Extend modifier pattern to badge

**File:** `frontend/src/styles/primitives/badge.css`

Same pattern — local var overrides for background, color, border.

---

### Task 3.3 — Extend modifier pattern to modal

**File:** `frontend/src/styles/primitives/modal.css`

Add `--modal-bg`, `--modal-border` local variable slots.

---

### Task 3.4 — Extend modifier pattern to form inputs

**File:** `frontend/src/styles/primitives/form.css`

Add `--input-bg`, `--input-border`, `--input-fg` local variable slots. Add `.input--error` modifier.

---

## Phase 4: Theme architecture

### Task 4.1 — Derive semantic tokens from base palette

**File:** `frontend/src/styles/tokens.css`

Replace hardcoded semantic colors with `color-mix()` derivations from the base palette:

```css
/* Instead of hardcoded values */
--color-border-soft: rgba(255, 255, 255, 0.12);
--color-border-faint: rgba(255, 255, 255, 0.08);

/* Derive from base-content */
--color-border-soft: color-mix(in srgb, var(--color-base-content) 12%, transparent);
--color-border-faint: color-mix(in srgb, var(--color-base-content) 8%, transparent);
```

**Actions:**
1. Identify which tokens can be derived from `--color-base-content` and `--color-base-100`
2. Replace with `color-mix()` expressions
3. Test in both dark and light themes

**Result:** `themes/light.css` needs to override fewer tokens — only the base palette changes, derived values update automatically.

---

### Task 4.2 — Reduce light theme file to base palette only

**File:** `frontend/src/styles/themes/light.css`

After Task 4.1, light.css should only override:
- `--color-base-100`, `--color-base-200`, `--color-base-content`
- `--color-primary`, `--color-primary-content`
- `--color-secondary`, `--color-secondary-content`
- `--color-accent`, `--color-accent-content`
- `--color-muted`
- `--color-placeholder`
- `--shell-gradient` (keep as explicit override — gradients don't derive well)

Remove all derived token overrides that are now handled by `color-mix()`.

**Verification:** Visual comparison — light theme renders identically.

---

## Phase 5: Utility layer (optional)

### Task 5.1 — Add layout utility classes

**File:** `frontend/src/styles/utils.css` (new)

Small set of composable layout utilities:

```css
/* Flex layouts */
.flex-row { display: flex; align-items: center; gap: var(--space-3); }
.flex-col { display: flex; flex-direction: column; gap: var(--space-3); }
.flex-between { justify-content: space-between; }
.flex-fill { flex: 1; min-width: 0; }

/* Grid layouts */
.grid-gap { display: grid; gap: var(--space-3); }

/* Text */
.text-muted { color: var(--color-muted); }
.text-eyebrow {
  color: var(--color-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

**Actions:**
1. Create `styles/utils.css`
2. Import it in `app.css` after primitives
3. Audit templates for repeated inline CSS patterns
4. Replace 3-4 inline patterns per task (don't do all at once)

**Verification:** `npm run build` — no style regression.

---

## Phase 6: Documentation

### Task 6.1 — Write CSS conventions guide

**File:** `docs/css-conventions.md` (new)

Document:
- Token tiers (foundations vs semantic vs component-local)
- Naming conventions (BEM double-underscore, `is-*` states, `--` modifiers)
- Primitive modifier pattern
- File scoping rules (one concern per file)
- Theme override strategy
- When to add a global token vs a local variable

---

## Dependencies

```
Phase 1 (no deps)
  -> Phase 2 (needs Phase 1 file moves to know where tokens are used)
    -> Phase 3 (needs Phase 2 token cleanup so primitives own their tokens)
      -> Phase 4 (needs Phase 3 primitives to be clean before deriving tokens)
        -> Phase 5 (independent, but best done last)
          -> Phase 6 (documents the final state)
```

## Estimated effort per phase

- Phase 1: 1-2 hours (mechanical moves + one bug fix)
- Phase 2: 2-3 hours (audit is the work; changes are mechanical)
- Phase 3: 1-2 hours (pattern is established by button.css)
- Phase 4: 2-3 hours (color-mix derivation needs testing)
- Phase 5: 1-2 hours (optional, incremental)
- Phase 6: 30 minutes (document what exists)

## Rollback strategy

Each task is a self-contained git commit. If a task causes visual regression, revert that single commit. No task requires another task to be completed first (except Phase 4 depends on Phase 2/3 for cleanliness).
