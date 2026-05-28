# NAF-HTML Usage Guidelines

## Purpose

This project uses a local `naf-html` runtime to reduce repeated frontend wiring patterns.

The goal is not to recreate a framework. The goal is to make the common cases smaller, clearer, and more consistent:

- local reactive state
- DOM binding
- keyed list rendering
- form input syncing
- lifecycle cleanup

Use these guidelines to keep modules consistent across future changes.

## Core Principle

Use `naf-html` when it removes repeated wiring.

Do not use it just because a helper exists.

The best use cases are:

- local UI state in a feature module
- state-to-DOM syncing
- keyed collection rendering
- input binding
- cleanup consolidation

## Helper Guide

### `signal(initialValue)`

Use for mutable local state.

Good uses:

- open/closed state
- busy/loading state
- current input values
- selected local item
- local error messages

Prefer local `signal()` state when the state belongs to one feature instance and does not need to be shared across modules.

Do not put everything in shared `state/*` by default.

### `computed(fn)`

Use for derived values that depend on one or more signals.

Good uses:

- filtered lists
- booleans derived from multiple local signals
- counts or labels derived from state

Do not use `computed()` for side effects.

### `effect(fn)`

Use for coordination and side effects.

Good uses:

- syncing state into external APIs
- reacting to state changes that trigger work
- top-level feature coordination

Use carefully. If an `effect()` starts containing business logic, branching workflow logic, or large chunks of DOM updates, that is a sign to simplify or split the code.

Prefer `fx()` for element-specific DOM syncing.

### `fx(el, fn)`

Use for binding reactive state to one element.

This should be the default helper for:

- `hidden`
- `disabled`
- `textContent`
- `classList`
- `attributes`
- small style updates

`fx()` is usually clearer than a large manual `render()` function because the binding stays close to the element it affects.

Prefer multiple small `fx()` calls over one giant DOM-sync effect.

### `model(el, sig, { reactive: true })`

Use for form controls backed by a signal.

This should be the standard approach for:

- text inputs
- textareas
- selects
- checkboxes

Typical pattern:

- `signal()` owns the local value
- `model()` binds the control to the signal
- `fx()` handles derived UI like error visibility or disabled state

Avoid manually setting `input.value` in a separate render path if `model()` already owns the binding.

### `list(container, templateEl, items, key, setup)`

Use for keyed collection rendering.

Good uses:

- tree rows
- toast stacks
- dialog option lists
- import preview sections and rows
- any dynamic repeated UI where entries need stable identity

Prefer `list()` over rebuilding `replaceChildren()` loops when:

- items have stable IDs
- row-level setup has listeners or effects
- entries should be updated incrementally

Avoid `list()` for one-off static DOM.

### `cleanupCollector(...)`

Use when a module registers multiple effects, listeners, bindings, or timers.

This should be the standard cleanup pattern for feature modules with more than one teardown step.

Good uses:

- combining event listener removals
- combining `effect()` cleanup functions
- combining `model()` cleanup functions
- combining nested sub-feature cleanup functions

Prefer one obvious cleanup path per module.

## Shared State vs Local State

### Put state in `state/*` when:

- multiple modules need it
- it reflects app/session state
- it affects cross-feature coordination
- it should survive refreshes or tie into persistence

Examples:

- current file path
- tree state
- search state
- move dialog state
- app-level modal state

### Keep state local with `signal()` when:

- it belongs to one feature instance
- it is purely presentational or transient
- it does not need to be imported elsewhere

Examples:

- form open state
- local edit mode
- input drafts
- local error message
- local loading indicator

## Preferred Module Pattern

For `features/*`, prefer this rough shape:

1. Create DOM
2. Define local signals
3. Bind inputs with `model()`
4. Define event handlers
5. Add small `fx()` bindings
6. Add any coordinating `effect()` calls
7. Return one cleanup path

This is not a strict template, but it keeps modules easier to scan.

## Prefer This Over `render()`

Large imperative `render()` functions should usually be treated as a smell.

They are acceptable when:

- the UI is very small
- the whole surface genuinely changes together
- splitting into fine-grained bindings would be harder to read

But in most feature modules, prefer:

- `model()` for inputs
- `fx()` for element bindings
- `list()` for repeated structures

This keeps updates local and reduces “rewrite the whole subtree” code.

## List Rendering Guidance

When using `list()`:

- always use stable keys
- keep row setup small
- let row setup return cleanup
- move row-specific logic into a submodule if the setup becomes large

If `setup()` grows into a large function with multiple behaviors, split it into a dedicated renderer or child feature.

## Cleanup Rules

If a module creates any of the following, it must clean them up:

- event listeners
- `effect()` subscriptions
- `model()` bindings
- timers
- nested feature instances
- list row bindings

Prefer `cleanupCollector()` once the cleanup list is longer than a couple of entries.

## When Not To Use NAF-HTML

Do not force helpers into places where plain DOM code is clearer.

Examples:

- static DOM created once with no reactive state
- very small modules with one listener and no local state
- cases where abstraction would hide more than it helps

The rule is:

- use helpers for repeated patterns
- keep plain DOM code for simple one-off logic

## Anti-Patterns To Avoid

- putting business logic inside large `effect()` bodies
- duplicating the same state in both a signal and manual mutable variables
- using `model()` and also manually resetting `input.value` from unrelated code
- rebuilding keyed collections manually when `list()` is a better fit
- scattering cleanup across multiple nested return paths
- moving shared app state into local signals just to shrink imports

## Review Checklist

When editing or creating a feature module, ask:

1. Should this state be local `signal()` state or shared `state/*` state?
2. Can `model()` replace manual input syncing here?
3. Can `fx()` replace manual `render()` DOM updates here?
4. Should this repeated UI use `list()`?
5. Is cleanup centralized and obvious?
6. Did using the helper make the code simpler, or just more abstract?

If the helper does not make the code simpler, do not force it.
