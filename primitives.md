# Primitive Extraction Plan

## Reader And Goal

This document is for an internal engineer extending the current frontend into a more generically reusable style system.

After reading it, the engineer should be able to:

1. decide which new primitives are justified now
2. distinguish app-specific styling from reusable primitive contracts
3. implement the next primitives in an order that reduces churn

## Current Primitive Baseline

The current system already has a good base:

- `alert`
- `badge`
- `button`
- `card`
- `eyebrow`
- `form`
- `icon-mask`
- `menu-item`
- `modal`
- `panel`
- `spinner`

That means the next useful primitives should only be added when they provide one of these:

- a reusable structural contract used by multiple screens
- a safe customization surface that removes feature-level overrides
- a clearly reusable interaction shell that can support multiple products, not just bookmarks

Do not add a primitive just because two selectors happen to share a few declarations.

## Current Pattern Inventory

The codebase has clear repetition in these pattern families:

- vertically stacked sections with consistent gap handling
- inline groups of controls and metadata
- boxed list shells with header, filter area, scroll area, and empty state
- sectioned surfaces with rows and dividers
- empty-state layouts
- small overlay indicators attached to an icon or trigger
- modal header/title/subtitle composition

The codebase does not yet have enough real usage to justify interaction-heavy primitives like accordion, dock, or drawer as production primitives today, but they can still be designed now as platform primitives for future work.

## Recommended Primitive Decisions

### Extract Now

These have enough repetition or enough structural value to justify immediate extraction.

#### 1. `stack`

Purpose:
Standard vertical layout primitive for grouped content with consistent gaps and optional alignment.

Why now:
Many feature and component shells are just local grid stacks with recurring gap values.

Suggested API:

- `.stack`
- `--stack-gap`
- optional modifiers for compact and spacious spacing

Typical use:

- detail sections
- dialog bodies
- grouped metadata blocks
- placeholder stacks

Contract:
Own only flow and spacing. Do not own surface styling.

#### 2. `cluster`

Purpose:
Inline layout primitive for controls, action rows, chips, badges, and wrapped utility groups.

Why now:
The app repeatedly builds `display: flex`, `align-items: center`, `gap`, and sometimes `flex-wrap` groups by hand.

Suggested API:

- `.cluster`
- `--cluster-gap`
- `--cluster-wrap`
- `--cluster-justify`
- `--cluster-align`

Typical use:

- toolbar groups
- detail action rows
- titlebar rows
- tree pane header actions

Contract:
Own alignment and wrapping only. Do not prescribe button or icon styling.

#### 3. `empty-state`

Purpose:
Reusable empty/loading/placeholder shell with title, subtitle, optional icon, and optional supporting content.

Why now:
There are already distinct empty-state treatments in tree, detail, import preview, and move dialog. They are not identical, but they are close enough to support a single base shell with variable hooks.

Suggested API:

- `.empty-state`
- `.empty-state__title`
- `.empty-state__subtitle`
- `.empty-state__media`
- `.empty-state--centered`
- `.empty-state--inline`

Typical use:

- tree empty state
- detail empty state
- dialog no-results state
- placeholder cards

Contract:
Own layout and text hierarchy. Let surfaces decide whether the shell sits in a panel, list, or full pane.

#### 4. `icon-badge`

Purpose:
Generic overlay primitive for attaching a corner marker to another element.

Why now:
The current “icon with plus” pattern appears in more than one place, and the more general concept is valuable beyond plus icons.

Design direction:
This should not be a special-case “plus badge” primitive. It should be a generic anchored overlay primitive that can place any element in the corner of a host.

Suggested API:

- `.icon-badge`
  The host element.
- `.icon-badge__corner`
  The overlay element.
- placement hooks:
  `--icon-badge-top`
  `--icon-badge-right`
  `--icon-badge-size`
  `--icon-badge-radius`
  `--icon-badge-shadow`

Supported overlay content:

- icon mask
- text span
- status dot
- image
- arbitrary indicator element

Typical use:

- add-folder trigger
- add-bookmark trigger
- future sync/status indicators
- future unread/error markers

Contract:
Own anchoring and overlay box positioning. Do not own the overlay content semantics.

#### 5. `list-shell`

Purpose:
Reusable boxed list container with optional header, filter area, list body, and empty state.

Why now:
The move dialog already has a full instance of this pattern, and import/merge uses a nearby sectioned-list pattern that can share parts of the model.

Suggested API:

- `.list-shell`
- `.list-shell__header`
- `.list-shell__filter`
- `.list-shell__body`
- `.list-shell__empty`

Typical use:

- move target picker
- future command palettes
- selectable settings lists
- future navigation lists

Contract:
Own container layout and internal separators. Do not own row selection styling.

### Extract Later

These are good primitives, but the current codebase does not yet justify them strongly enough.

#### 6. `surface-section`

Purpose:
Reusable internal section framing for bordered surfaces with divided header/body/footer or row groups.

Why later:
The system already has `panel` and `modal`, and the remaining repeated section shells are still slightly inconsistent in structure. This becomes worthwhile once more views converge on the same header-row-body pattern.

Best future use:

- keyboard shortcuts sections
- import/merge sections
- grouped settings surfaces

#### 7. `dialog-header`

Purpose:
Reusable title/subtitle/action header composition for dialogs and overlays.

Why later:
There is clear repetition, but the app only has a few dialogs and they still have slightly different composition rules. Extract this only after the next dialog or two confirms a stable pattern.

#### 8. `metadata-list`

Purpose:
Structured supporting-information primitive for dates, counts, paths, and secondary descriptors.

Why later:
The app has repeated muted metadata, but not yet a single stable structure. The semantics are there, the container contract is not.

### Design Now, Implement When Product Needs It

These are valid primitives for a reusable style system, but they are not justified by current app repetition. They should be designed now and only implemented when a concrete feature uses them.

#### 9. `collapse`

Purpose:
Generic show/hide content region with animated height or opacity transition.

Why design now:
It is a foundational interaction shell that other primitives can build on.

Suggested scope:

- collapsed and expanded states
- reduced-motion compatibility
- overflow handling
- optional transition tokens

Important boundary:
This should be behavior-agnostic. It is not itself an accordion.

#### 10. `accordion`

Purpose:
Structured disclosure primitive built on top of `collapse`.

Why design now:
Useful for settings, help content, grouped diagnostics, or future bookmark inspections.

Suggested API:

- `.accordion`
- `.accordion__item`
- `.accordion__trigger`
- `.accordion__panel`

Important boundary:
Treat `accordion` as composed behavior plus structure. Keep the lower-level `collapse` separate.

#### 11. `drawer`

Purpose:
Off-canvas sidebar or edge panel that slides in over or beside the main layout.

Why design now:
A reusable app shell benefits from a drawer concept even if this desktop app does not currently need one.

Suggested variants:

- left and right edge placement
- modal drawer
- persistent drawer
- responsive drawer that collapses into overlay mode

Good future uses:

- mobile navigation
- settings panel
- contextual inspector

#### 12. `dock`

Purpose:
Bottom navigation bar or action dock anchored to the screen edge.

Why design now:
It is relevant if the style system is intended to support mobile or tablet surfaces, but it has no real usage in the current product.

Suggested variants:

- navigation dock
- action dock
- floating dock
- inset dock

Important boundary:
Do not build this for desktop-only assumptions. Treat it as a responsive primitive from the start.

## Recommended Implementation Order

If the goal is to keep expanding the style system from the current codebase, use this order:

1. `stack`
2. `cluster`
3. `empty-state`
4. `icon-badge`
5. `list-shell`
6. `surface-section`
7. `dialog-header`
8. `metadata-list`
9. `collapse`
10. `accordion`
11. `drawer`
12. `dock`

This order matters:

- the first five are supported by today’s code repetition
- the next three need more convergence before extraction
- the last four are platform primitives that should follow product demand

## Concrete Extraction Plan

### Phase 1: Finish The Layout Foundation

Implement:

- `stack`
- `cluster`

Refactor targets:

- titlebar rows
- toolbar groups
- detail action rows
- tree pane action groups
- stacked detail content groups

Success criteria:

- repeated flex/grid gap containers are materially reduced
- alignment decisions move into primitive hooks instead of local selectors

### Phase 2: Standardize State Shells

Implement:

- `empty-state`
- `icon-badge`

Refactor targets:

- detail empty state
- tree empty state
- move dialog empty state
- add-folder and add-bookmark triggers with corner indicators

Success criteria:

- empty states share hierarchy and spacing rules
- overlay badge logic is not duplicated per feature

### Phase 3: Standardize Selectable Containers

Implement:

- `list-shell`

Refactor targets:

- move dialog list container
- future pickers and chooser dialogs

Success criteria:

- header, filter, list body, and empty state composition become reusable
- list container layout is separated from row styling

### Phase 4: Consolidate Sectioned Surfaces

Implement when repetition increases:

- `surface-section`
- `dialog-header`
- `metadata-list`

Success criteria:

- multiple dialogs and panels share section and heading structure
- extraction reduces complexity rather than adding indirection

### Phase 5: Expand To App-Shell Primitives

Implement when a real feature needs them:

- `collapse`
- `accordion`
- `drawer`
- `dock`

Success criteria:

- each primitive ships with at least one real product use
- responsive and accessibility behavior is part of the contract from the first implementation

## Primitive Contracts To Preserve

For every new primitive:

- structure should live in the primitive
- theme decisions should still live in theme tokens
- feature state classes should stay local unless the state is truly cross-product
- primitive customization should happen through variables and bounded modifiers
- interaction-heavy primitives should separate structure from behavior where practical

## What Not To Extract Yet

Do not extract these yet:

- `title-block`
  Too small and too context-dependent.
- additional icon-mask abstractions beyond `icon-badge`
  The remaining duplication is still mostly per-icon mapping.
- tree row selection styling
  That is feature behavior, not primitive structure.
- bookmark-specific detail layouts
  They are still product-specific views, not reusable primitives.

## Decision Summary

If the goal is a more generic style system, the best next primitives are:

- `stack`
- `cluster`
- `empty-state`
- `icon-badge`
- `list-shell`

The best primitives to design but not implement until product demand exists are:

- `collapse`
- `accordion`
- `drawer`
- `dock`

That split keeps the system honest: first extract what the current app has already proven, then add broader platform primitives only when the product surface justifies them.
