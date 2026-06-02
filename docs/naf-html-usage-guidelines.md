# NAF Runtime Usage Guidelines

## Purpose

This frontend uses a single local NAF runtime for both:

- low-level reactive and DOM helpers
- module-local template and component helpers

The runtime entrypoint is `naf.js`.

The goal of this document is to explain when to use each helper and when not to.

## Reader

This document is for engineers writing or changing frontend modules.

After reading it, you should be able to:

- choose the right NAF helper for a new module
- decide whether a module should use `template()` or direct DOM code
- structure state, effects, and cleanup consistently

## Core Principle

Use NAF when it makes ownership clearer.

Do not use NAF just because a helper exists.

The runtime should make common cases smaller and more predictable:

- local state
- shell-local markup
- fine-grained DOM binding
- keyed list rendering
- centralized cleanup

If plain DOM is clearer, keep plain DOM.

## Runtime Surface

Treat `naf.js` as the single runtime entrypoint.

The current runtime surface includes:
- `signal()`
- `computed()`
- `effect()`
- `mount()`
- `template()`
- `when()`
- `fx()`
- `show()`
- `hide()`
- `model()`
- `list()`
- `cleanupCollector()`
- `listener()`
- `requireRef()`
- `requireElement()`
- `$()`
- `$$()`
- `attr()`
- `setText()`
- `text()`

Use one runtime import surface per module. Do not split runtime imports across multiple helper files.

The current app-state style alongside NAF is:

- read state through selectors such as `appState.selectors.getCurrentFilePath()`
- write state through actions such as `appState.actions.setCurrentFilePath(path)`
- all state modules follow the signals/actions/computed/selectors pattern

See `docs/frontend-architecture.md` for the canonical state module shape.

## Choosing The Right Level

### Use `template()` for bounded shells

Use `template()` when a module is mainly:

- local markup
- element lookup
- mount-time listener wiring
- bounded cleanup

Typical good fits:

- pages
- dialogs
- titlebar and toolbar shells
- bounded feature shells

Typical signs:

- the main value is markup locality
- the lifecycle is easy to describe as mount and unmount
- the module is not dominated by row-level or field-level behavior

Current preferred authoring pattern:

1. define markup with `template()`
2. mark important local nodes with `data-ref`
3. use `onMount(el, parent, ctx)` and read `ctx.refs`
4. register cleanup through one obvious cleanup path
5. mount with `mount(component, host)` instead of writing `innerHTML` manually

This keeps ownership local to the component subtree rather than depending on broad parent queries.

If the module still needs several broad shell queries after that, the boundary is probably wrong and should be re-cut rather than patched with more helpers.

### Use direct DOM plus NAF helpers for interaction-heavy surfaces

Keep direct DOM ownership when a module is mainly:

- field bindings
- row updates
- keyboard interaction
- pointer interaction
- drag and drop
- fine-grained incremental UI updates

Typical good fits:

- tree rows
- detail editors
- drag-and-drop controllers
- keyboard systems
- row-level search and tree rendering

`template()` is not a goal by itself. It is one tool.

### Use `when()` only when it genuinely simplifies branching

Good uses:

- page branches
- empty-state versus loaded-state branches
- small conditional shell composition

Avoid `when()` for:

- row rendering
- drag-and-drop surfaces
- cases where imperative mount and cleanup are already clearer

## Helper Guide

### `signal(initialValue)`

Use for mutable local state.

Good uses:

- open or closed state
- local loading state
- draft form values
- local error messages
- local mode toggles such as editing

Prefer local `signal()` state when the state belongs to one mounted instance.

### `computed(fn)`

Use for derived values that depend on signals.

Good uses:

- derived labels
- filtered collections
- booleans derived from several local signals
- counts or status text

Do not use `computed()` for side effects.

### `effect(fn)`

Use for coordination and side effects.

Good uses:

- syncing state into the DOM when a narrower helper does not fit
- reacting to state changes that trigger work
- coordinating mount-level behavior

Keep `effect()` bodies small.

If an effect starts owning business logic, branching workflows, and many DOM updates at once, simplify it or split the module.

### `fx(el, fn)`

Use for element-scoped reactive binding.

Good uses:

- `hidden`
- `disabled`
- `textContent`
- `classList`
- attributes
- small style updates

Prefer multiple small `fx()` bindings over one large DOM-sync effect when that improves clarity.

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

### `model(el, sig, { reactive: true })`

Use for form controls bound to a signal.

This is the standard approach for:

- text inputs
- textareas
- selects
- checkboxes

Typical pattern:

1. `signal()` owns the local value
2. `model()` binds the control
3. `fx()` or `effect()` handles derived UI such as error state or button availability

Avoid manually fighting `model()` with unrelated `input.value` assignments.

### `list(container, templateEl, items, key, setup)`

Use for keyed repeated UI with stable identity.

Good uses:

- tree rows
- search result rows
- toast stacks
- dialog option lists

Prefer `list()` over rebuilding `replaceChildren()` loops when:

- items have stable keys
- row setup has listeners or effects
- entries should update incrementally

Avoid `list()` for static or one-off markup.

### `cleanupCollector(...)`

Use when a module registers several cleanups.

Good uses:

- listeners
- effects
- model bindings
- nested mounts
- timers

Prefer one obvious cleanup path per module.

### `mount(component, host)`

Use `mount()` as the default way to attach a template-backed component to a dedicated host.

Good uses:

- titlebar
- dialogs
- bounded shell sections mounted into known anchors

`mount()` should replace the older pattern:

1. `host.innerHTML = component.html`
2. `component.mount(host)`

The older pattern still exists in older modules, but new or migrated modules should use `mount()` directly.

### Local refs with `data-ref`

Prefer `data-ref` markers over repeated `querySelector()` calls when a template-backed component owns the markup.

Good uses:

- action buttons
- dialog shell nodes
- local headings or status nodes
- shell wrappers that are only meaningful inside one component

Keep refs local:

- only mark elements the component truly owns
- do not use `data-ref` as a global lookup mechanism
- if a module is mostly broad shell scavenging, it probably still needs a boundary cleanup rather than more refs

Use `querySelector()` only when:

- the node is not truly owned by the current template
- the module is intentionally binding into a stable external shell anchor
- imperative DOM ownership is clearer than ref-marking

### `listener(el, event, handler)`

Attach an event listener and return a cleanup function.

Use with `cleanupCollector()` to avoid manual addEventListener/removeEventListener pairing:

```js
// Instead of:
el.addEventListener("click", handleClick);
cleanup.add(() => el.removeEventListener("click", handleClick));

// Write:
cleanup.add(listener(el, "click", handleClick));
```

Good uses:

- click handlers on buttons
- keydown handlers on inputs
- scroll or resize listeners
- any listener that needs cleanup on unmount

Prefer `listener()` over manual addEventListener/removeEventListener pairing. It is null-safe (handles missing refs) and returns a cleanup function that works directly with `cleanupCollector()`.

### `requireRef(refs, name)`

Require a ref from a component's refs map and throw if it is missing.

Use inside `onMount` callbacks to replace the 3-line instanceof validation pattern with a single call:

```js
// Instead of:
const titleInput = ctx.refs.titleInput;
if (!(titleInput instanceof HTMLInputElement)) {
  throw new Error("Expected bookmark detail title input");
}

// Write:
const titleInput = requireRef(ctx.refs, "titleInput");
```

Good uses:

- validating refs from `ctx.refs` in template onMount callbacks
- replacing repetitive instanceof checks

Returns `Element`. Callers that need type narrowing should use JSDoc type assertions.

### `requireElement(root, selector, description)`

Query an element and throw if it is not found.

Use in `collectShell` functions to replace the 3-line querySelector + instanceof validation pattern with a single call:

```js
// Instead of:
const titlebar = root.querySelector("#titlebar");
if (!(titlebar instanceof HTMLElement)) {
  throw new Error("Expected #titlebar element");
}

// Write:
const titlebar = requireElement(root, "#titlebar", "titlebar");
```

Good uses:

- shell collection functions that query stable DOM anchors
- replacing querySelector + instanceof validation blocks

Returns the queried element with a generic type for JSDoc narrowing.

### `$()`, `$$()`, `attr()`, `setText()`, `text()`

Use these as lightweight DOM helpers, not as a mini-framework.

Good uses:

- local element lookup
- simple attribute and text syncing
- text escaping when building HTML strings

Do not build deep custom abstractions on top of them unless the pattern is genuinely repeated.

## Shared State Versus Local State

Put state in shared state modules when:

- several modules need it
- it represents app or session state
- it coordinates features
- it should survive restore or persistence flows

Keep state local with `signal()` when:

- it belongs to one mounted instance
- it is transient or presentational
- no other module should import it

Use the smallest ownership scope that still matches the real behavior.

For shared state surfaces:

- use the canonical signals/actions/computed/selectors pattern
- keep private signals module-scoped
- expose reads via selectors and writes via actions
- avoid parallel APIs that expose the same value through multiple naming schemes

## Recommended Module Shapes

### Template-owned shell

Use this rough flow:

1. declare markup with `template()`
2. gather important elements in `onMount`
3. wire listeners and effects
4. store cleanup with `cleanupCollector()`
5. release everything in `onUnmount`

This is a good fit for pages, dialogs, and reusable shell components.

### Imperative feature surface

Use this rough flow:

1. create or collect DOM
2. define local signals
3. bind inputs with `model()`
4. register listeners
5. add `fx()` or `effect()` bindings
6. mount repeated rows with `list()` if needed
7. return one cleanup path

This is a good fit for dense editors, rows, and interaction-heavy feature surfaces.

## When Not To Use NAF

Do not force helpers into places where plain DOM code is clearer.

Examples:

- static markup created once with no local state
- very small modules with one listener and no meaningful repeated pattern
- interaction-heavy modules where a template would hide ownership instead of clarifying it

The rule is simple:

- use the helper when it reduces repeated wiring
- skip the helper when it adds indirection without a payoff

## Anti-Patterns

Avoid these:

- large `effect()` bodies that mix business logic and DOM sync
- duplicated state in both signals and manual mutable variables
- manual input syncing where `model()` should own the control
- rebuilding keyed lists manually when `list()` is a better fit
- scattered cleanup paths
- moving shared app state into local signals just to shrink imports
- forcing `template()` into tree, DnD, or dense editor modules for consistency alone
- using `when()` where plain mount logic is easier to understand

## Review Checklist

When creating or editing a frontend module, ask:

1. Is this mostly a bounded shell or an interaction-heavy surface?
2. Should the shell be a `template()`?
3. Should the state be local `signal()` state or shared state?
4. Can `model()` or `fx()` remove repeated wiring here?
5. Should repeated UI use `list()`?
6. Is cleanup obvious and centralized?
7. Did using NAF make the code clearer, or only more abstract?

If the helper does not improve clarity, do not force it.
