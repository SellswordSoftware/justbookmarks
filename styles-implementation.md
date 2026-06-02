# Styles Implementation Checklist

## Purpose

This file turns the style-system analysis into an implementation-ready checklist for the current frontend codebase.

Goals:

- make style ownership clearer
- keep theme logic isolated
- reduce repeated declaration blocks
- improve the mental model for future style changes
- add guardrails so drift does not return

This plan is ordered to favor low-risk, mechanical migrations first.

---

## Target Style Architecture

Use these layers as the styling contract:

1. `reset`
2. `tokens`
3. `themes`
4. `base`
5. `primitives`
6. `components`
7. `features`
8. `utilities`

Rules:

- `tokens.css` defines semantic variables and shared scales only.
- `themes/*.css` assign theme values only.
- `primitives/` hold reusable building blocks.
- `components/` and `features/` consume primitives and tokens.
- Theme selectors like `[data-theme="light"]` belong only in `themes/`.
- Feature CSS should not reach into component internals unless the component exposes variable hooks.

---

## Batch 1: Formalize The Cascade

### Goal

Make the stylesheet order explicit before changing behavior.

### Files

- `frontend/src/styles/app.css`

### Edits

- Add `@layer` declarations for the global ordering.
- Wrap each import in the appropriate layer.
- Keep the current import order intact during this step.

### Likely shape

```css
@layer reset, tokens, themes, base, primitives, components, features, utilities;

@import "./reset.css" layer(reset);
@import "./tokens.css" layer(tokens);
@import "./themes/light.css" layer(themes);
@import "./themes/dark.css" layer(themes);
```

### Verification

- App renders unchanged.
- No missing styles due to import ordering mistakes.

---

## Batch 2: Make Theme Ownership Symmetric

### Goal

Stop using `tokens.css` as a hidden dark theme and move all real theme values into theme files.

### Files

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/themes/light.css`
- `frontend/src/styles/themes/dark.css`
- `frontend/index.html`
- `frontend/src/app/lifecycle.js`

### Edits

- Reduce `tokens.css` to neutral semantic declarations and shared scales.
- Move dark-specific values from `:root` in `tokens.css` into `[data-theme="dark"]` in `themes/dark.css`.
- Keep `light.css` and `dark.css` structurally parallel so a future third theme has an obvious place to live.
- Keep `data-theme="light"` boot behavior unchanged unless there is a separate product decision to change the default theme.

### Specific items to move out of `tokens.css`

- color palette variables
- surface variables
- border variables
- interactive state colors
- danger/alert colors
- icon colors
- modal/backdrop colors
- misc surface colors

### Keep in `tokens.css`

- spacing scale
- radius scale
- border width token
- typography scale tokens if added
- semantic token names with fallback-neutral defaults only if needed
- mask asset variables if they remain global

### Verification

- Theme switching still works through `data-theme`.
- Dark mode renders correctly after moving values.

---

## Batch 3: Remove Theme Leakage From Module CSS

### Goal

Ensure theme decisions live only in theme files.

### Files

- `frontend/src/styles/primitives/button.css`
- `frontend/src/features/tree/styles/tree-list.css`
- `frontend/src/features/tree/styles/tree-pane.css`
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/themes/light.css`
- `frontend/src/styles/themes/dark.css`

### Edits

- Remove `[data-theme="light"]` overrides from `button.css`.
- Remove `[data-theme="light"]` overrides from `tree-list.css`.
- Delete or resolve the commented theme-specific code in `tree-pane.css`.
- Replace those rules with semantic tokens defined in `light.css` and `dark.css`.

### New tokens to introduce

- `--color-btn-primary-border`
- `--color-btn-primary-hover-bg`
- `--color-btn-secondary-border`
- `--color-btn-secondary-hover-bg`
- `--color-selected-strong-outline`
- `--color-selected-muted-text`

### Likely edits in `button.css`

- Change `.btn-primary` to use `var(--color-btn-primary-border)` and `var(--color-btn-primary-hover-bg)`.
- Change `.btn-secondary` to use `var(--color-btn-secondary-border)` and `var(--color-btn-secondary-hover-bg)`.

### Likely edits in `tree-list.css`

- Change `.tree-row.is-primary` box-shadow to `var(--color-selected-strong-outline)`.
- Change selected meta/count text to `var(--color-selected-muted-text)`.

### Verification

- Light and dark themes still match current intent.
- No `[data-theme=...]` remains outside `frontend/src/styles/themes/`.

---

## Batch 4: Standardize Selected-State Styling

### Goal

Unify “primary selected row” behavior across tree and move dialog UIs.

### Files

- `frontend/src/features/tree/styles/tree-list.css`
- `frontend/src/features/move/move-dialog.css`
- `frontend/src/styles/themes/light.css`
- `frontend/src/styles/themes/dark.css`

### Edits

- Use the same selected-state helper tokens in both tree rows and move-dialog rows.
- Keep structural state classes like `.is-primary` local to each feature.
- Move only color and glow decisions into shared tokens.

### Specific lines of concern

- `tree-list.css`: selected row border/background/meta styling
- `move-dialog.css`: `.move-dialog__tree-row.is-primary .move-dialog__tree-path`

### Verification

- Selection visuals remain readable in both themes.
- Move dialog and tree list feel visually related instead of independently tuned.

---

## Batch 5: Introduce A `panel` Primitive

### Goal

Replace repeated bordered-surface blocks with a reusable primitive.

### Files To Add

- `frontend/src/styles/primitives/panel.css`

### Files To Update

- `frontend/src/styles/app.css`
- `frontend/src/features/detail/styles/detail-surface.css`
- `frontend/src/styles/primitives/card.css`
- `frontend/src/features/move/move-dialog.css`
- `frontend/src/features/import-merge/import-merge-dialog.css`

### Base primitive

Suggested starting API:

```css
.panel {
  display: grid;
  gap: var(--panel-gap, 0.875rem);
  padding: var(--panel-padding, 0.875rem 1rem);
  border: var(--border) solid var(--color-border-quiet);
  border-radius: var(--panel-radius, var(--radius-field));
  background: var(--panel-bg, var(--color-surface-1));
}
```

### First migration targets

- `detail-surface.css`
  - `.add-folder-panel`
  - `.add-bookmark-panel`
  - `.folder-detail__header`
  - `.folder-detail__edit`
  - `.bookmark-detail__header`
  - `.bookmark-detail__notes`
  - `.bulk-selection-detail__header`
  - `.bulk-selection-detail__footer`

### Secondary migration targets

- `card.css`
  - evaluate whether `.placeholder-card` should compose `panel`
- `move-dialog.css`
  - evaluate `.move-dialog__list-shell`
- `import-merge-dialog.css`
  - evaluate `.import-merge-dialog__stat`
  - evaluate `.import-merge-dialog__section`

### Notes

- Start with class composition in markup where practical.
- If markup changes would be too broad, use grouped selectors temporarily and convert later.
- Do not force every bordered box into `panel` if its structure differs significantly.

### Verification

- Detail panels render unchanged.
- Repeated declaration blocks are reduced materially.

---

## Batch 6: Introduce An `eyebrow` Primitive

### Goal

Unify small uppercase labels into one reusable pattern.

### Files To Add

- `frontend/src/styles/primitives/eyebrow.css`

### Files To Update

- `frontend/src/styles/app.css`
- `frontend/src/styles/primitives/form.css`
- `frontend/src/components/shell-panel/shell-panel.css`
- `frontend/src/features/detail/styles/detail-surface.css`
- `frontend/src/features/import-merge/import-merge-dialog.css`
- `frontend/src/features/move/move-dialog.css`
- `frontend/src/styles/primitives/badge.css`

### Base primitive

Suggested starting API:

```css
.eyebrow {
  color: var(--color-muted);
  font-size: var(--eyebrow-size, 0.75rem);
  font-weight: 700;
  letter-spacing: var(--eyebrow-spacing, 0.08em);
  text-transform: uppercase;
}
```

### Migration targets

- `form.css`
  - `.label`
- `shell-panel.css`
  - `.shell-panel__eyebrow`
- `detail-surface.css`
  - `.bulk-selection-detail__eyebrow`
- `import-merge-dialog.css`
  - `.import-merge-dialog__file-label`
- `move-dialog.css`
  - `.move-dialog__list-header`

### Decision to make during implementation

- Keep `badge.css` separate if badge styling is intentionally denser and more decorative.
- Otherwise let badge inherit the same uppercase scale via custom properties.

### Verification

- Label hierarchy remains readable.
- Letter spacing and sizes are more consistent across screens.

---

## Batch 7: Expose `shell-panel` Customization Hooks

### Goal

Stop feature CSS from overriding `shell-panel` internals directly.

### Files

- `frontend/src/components/shell-panel/shell-panel.css`
- `frontend/src/features/tree/styles/tree-pane.css`
- `frontend/index.html`

### Edits

- Add variable hooks to `shell-panel.css` for header/body padding and optionally gaps.
- Update `tree-pane.css` to set those variables on `.tree-pane` instead of targeting `.shell-panel__header` and `.shell-panel__body`.

### Suggested variable hooks

- `--shell-panel-header-padding`
- `--shell-panel-body-padding`
- `--shell-panel-header-gap`

### Likely edits

In `shell-panel.css`:

```css
.shell-panel__header {
  gap: var(--shell-panel-header-gap, var(--space-3));
  padding: var(--shell-panel-header-padding, 0.75rem 0.875rem 0.65rem);
}

.shell-panel__body {
  padding: var(--shell-panel-body-padding, 0.75rem 0.875rem 0.875rem);
}
```

In `tree-pane.css`:

```css
.tree-pane {
  --shell-panel-header-padding: 0.5rem 0.875rem 0.45rem;
  --shell-panel-body-padding: 0.45rem 0.35rem 0.75rem;
}
```

### Verification

- Tree pane still has its compact shell spacing.
- No descendant override of `shell-panel__*` remains in feature CSS.

---

## Batch 8: Normalize Type Scale

### Goal

Reduce small-size fragmentation first, then normalize the rest only where it pays off.

### Files

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/base.css`
- `frontend/src/styles/primitives/button.css`
- `frontend/src/styles/primitives/form.css`
- `frontend/src/styles/primitives/card.css`
- `frontend/src/styles/primitives/badge.css`
- `frontend/src/components/titlebar/titlebar.css`
- `frontend/src/components/shell-panel/shell-panel.css`
- `frontend/src/features/tree/styles/tree-list.css`
- `frontend/src/features/detail/styles/detail-surface.css`
- `frontend/src/features/import-merge/import-merge-dialog.css`
- `frontend/src/features/move/move-dialog.css`
- `frontend/src/pages/empty-library/empty-library-page.css`

### Edits

- Introduce named type tokens if desired, for example:
  - `--text-xs`
  - `--text-sm`
  - `--text-md`
  - `--text-lg`
  - `--text-xl`
- Consolidate the small-text cluster:
  - `0.6875rem`
  - `0.7rem`
  - `0.75rem`
  - `0.78rem`
  - `0.8rem`
- Defer larger heading changes unless they are clearly redundant.

### Recommended first-pass mapping

- `0.6875rem`, `0.7rem`, `0.75rem`, `0.78rem`, `0.8rem` -> `0.75rem`
- `0.8125rem` stays
- `0.875rem` stays
- `0.9375rem` and `0.95rem` should be evaluated case by case

### Notes

- Do not rewrite every font size in one pass unless the UI is visually regression-tested.
- Small-label normalization gives the best value with the lowest visual risk.

### Verification

- Text hierarchy still reads correctly.
- No cramped or oversized labels appear in modal, tree, or detail screens.

---

## Batch 9: Normalize Padding And Radius Semantics

### Goal

Turn recurring one-off padding/radius values into system choices.

### Files

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/primitives/modal.css`
- `frontend/src/styles/primitives/card.css`
- `frontend/src/components/shell-panel/shell-panel.css`
- `frontend/src/features/detail/styles/detail-surface.css`
- `frontend/src/features/import-merge/import-merge-dialog.css`
- `frontend/src/features/move/move-dialog.css`
- `frontend/src/styles/layout.css`

### Edits

- Add semantic padding tokens for repeated patterns if they continue to recur after primitive extraction.
- Example candidates:
  - `--padding-panel`
  - `--padding-header`
  - `--padding-compact`
- Reconcile current radius values:
  - `var(--radius-selector)`
  - `var(--radius-field)`
  - `var(--radius-box)`
  - literal `0.875rem` radii in dialog surfaces

### Specific items to review

- `detail-surface.css`: repeated `0.875rem 1rem`
- `modal.css`: header/footer/body padding
- `card.css`: `.placeholder-card`
- `import-merge-dialog.css`: file bar, loading shell, stat cards, section shells
- `move-dialog.css`: list shell

### Verification

- Surface rhythm feels more intentional.
- Radius and padding choices are easier to predict across the app.

---

## Batch 10: Clarify Primitive-Local Variables

### Goal

Make internal component vars visibly private and reduce confusion with global tokens.

### Files

- `frontend/src/styles/primitives/button.css`

### Edits

- Rename button-local vars from `--btn-*` to `--_btn-*`.
- Update `.btn` and its variants to use the private names consistently.

### Example

```css
.btn {
  border: var(--border) solid var(--_btn-border, var(--color-border-soft));
  background: var(--_btn-bg, transparent);
  color: var(--_btn-fg, var(--color-base-content));
}
```

### Verification

- No behavior change.
- Token scans can more easily distinguish global tokens from primitive-scoped vars.

---

## Batch 11: Clean Token Inventory

### Goal

Remove dead or misleading global tokens after migrations settle.

### Files

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/themes/light.css`
- `frontend/src/styles/themes/dark.css`
- `frontend/src/styles/primitives/alert.css`
- any CSS file still referencing legacy tokens

### Edits

- Re-check which global tokens are actually used after the earlier batches.
- Remove unused semantic tokens that no longer justify their existence.
- Align alert tokens and alert primitive behavior.

### Alert decision

Pick one of these and standardize it:

1. Keep solid alert backgrounds and remove the alert background tokens.
2. Use the existing alert background tokens in `alert.css` and make alerts softer.

### Notes

- Do not remove mask variables or other globals that are intentionally shared assets.
- Do not count private vars like `--_btn-*` as unused global design tokens.

### Verification

- No broken `var()` references remain.
- Token list is smaller and more intentional.

---

## Batch 12: Add Guardrails

### Goal

Prevent style drift from reappearing.

### Files To Add

- `frontend/.stylelintrc.*` or equivalent
- `frontend/package.json` script updates if needed
- optional: `docs/style-system-guidelines.md`

### Edits

- Add stylelint with rules for:
  - no raw colors outside `tokens.css` and `themes/*.css`
  - no `[data-theme=...]` outside theme files
  - consistent custom property naming
  - optional allowed-value constraints for font sizes and spacing
- Add a lint script.
- Optionally document the style architecture and rules in a short project doc.

### Suggested doc topics

- layer responsibilities
- when to create a primitive
- when to add a token
- how to theme new UI
- how to customize components safely with vars

### Verification

- Lint runs clean on the current codebase after migration.
- New style changes have a clear review contract.

---

## Optional Follow-Up Work

These are useful, but should wait until the higher-value cleanup above is done.

### Reassess file splitting

Files:

- `frontend/src/features/detail/styles/detail-surface.css`
- `frontend/src/features/tree/styles/tree-list.css`

Do this only if they remain hard to reason about after primitive extraction and state-token cleanup.

### Reassess icon mask deduplication

Files:

- `frontend/src/styles/primitives/icon-mask.css`
- `frontend/src/features/detail/styles/detail-surface.css`
- `frontend/src/features/tree/styles/tree-list.css`
- `frontend/src/features/tree/styles/tree-pane.css`

Keep current `-webkit-mask-*` compatibility unless tested safe to remove in the target Wails runtimes.

---

## Execution Order Summary

1. `app.css` cascade layers
2. symmetric theme ownership in `tokens.css` + `themes/*.css`
3. remove module-level theme selectors
4. selected-state token consolidation
5. `panel` primitive
6. `eyebrow` primitive
7. `shell-panel` variable hooks
8. type scale cleanup
9. padding/radius normalization
10. private primitive vars
11. token cleanup
12. stylelint and docs

---

## Definition Of Done

The style-system refactor is complete when all of the following are true:

- No `[data-theme=...]` selectors exist outside `frontend/src/styles/themes/`.
- No raw theme colors remain in component or feature CSS.
- Repeated bordered surface blocks are primitive-driven where repetition is clear.
- Repeated uppercase label patterns are primitive-driven where repetition is clear.
- `shell-panel` is customized via exposed variables, not descendant overrides.
- Themes are symmetric and complete.
- The token inventory is intentional and not carrying obvious dead weight.
- A lint rule set exists to enforce the architecture going forward.
