# NAF Developer Guide

## Who This Is For

This guide is for an engineer changing the frontend.

After reading it, you should be able to add a new UI element to an existing page, wire it into the right layer of the app, and make it reactive with `signal`, `effect`, `fx`, and `model` without falling back to ad hoc DOM construction.

## The Mental Model

Think of this frontend as an HTML-first app with a small local runtime, not as a framework app with a virtual DOM.

The important ideas are:

- The shell is long-lived.
- Pages mount into that shell.
- Features mount into pages or stable shell anchors.
- Components own bounded markup and their own listeners.
- Signals are the source of truth for reactive local state.
- Effects push signal state into the DOM in small, explicit steps.

`naf` is deliberately small. It gives you:

- state primitives
- mount and cleanup helpers
- a local templating model
- a way to bind DOM nodes to signals

It does not try to hide the DOM from you. The DOM is still real and still matters. `naf` just gives you a consistent ownership model.

## The Frontend Shape

The frontend is organized by responsibility.

### `app`

This layer boots the app, collects shell anchors, and decides which page is active.

If your change affects startup, global lifecycle, top-level mounting, or page switching, it belongs here.

### `pages`

A page owns one screen state.

A page should:

- activate the right shell frame
- mount the features needed for that screen
- clean them up when the page changes

If you are adding a new screen-level surface, start here.

### `features`

A feature owns product behavior.

Examples:

- tree behavior
- detail behavior
- search behavior
- editing workflows
- import and move flows

If the code answers a product question, it is probably a feature.

### `components`

A component is a bounded reusable UI surface.

Examples:

- titlebar
- dialogs
- toolbar sections
- toast container

If the UI can be mounted in one place, owns its own markup, and does not define a whole screen, it is probably a component.

### `layouts`

This layer owns structural shell behavior such as pane layout and resizing.

### `shared`

This layer owns cross-cutting pieces:

- the `naf` runtime
- app state
- API bindings
- infrastructure helpers

Use it only when the abstraction is truly shared.

## The NAF Runtime Model

The runtime has two halves:

- reactive state primitives
- component and DOM helpers

### Signals

A `signal` is both a getter and a setter.

```js
const open = signal(false);

open();      // read
open(true);  // write
```

This is the core mental model: local mutable state lives in signals.

### Computed Values

Use `computed` for derived state.

```js
const countLabel = computed(() => {
  const count = selectedCount();
  return `${count} item${count === 1 ? "" : "s"}`;
});
```

Do not use `computed` for side effects.

### Effects

Use `effect` when signal changes should cause work.

Typical uses:

- update shell metadata
- coordinate mount-level behavior
- trigger derived UI work that does not fit a narrower helper

An effect should stay small. If one effect is trying to synchronize an entire subtree, the module boundary is probably wrong.

### `fx`

Use `fx` for element-scoped reactive bindings.

Typical uses:

- `hidden`
- `disabled`
- `textContent`
- small class changes
- small style changes

The preferred pattern is many small bindings with obvious ownership, not one giant DOM sync function.

### `model`

Use `model` for form controls that mirror a signal.

Typical pattern:

1. Create a signal for the draft value.
2. Bind the input with `model(..., { reactive: true })`.
3. Use `fx` or `effect` for derived states like button disablement or error text.

### `cleanupCollector`

Use one cleanup collector per mounted component when it owns several effects, listeners, or bindings.

That keeps teardown simple and local.

## The Component Model

The preferred component shape is:

1. Define markup with `template(...)`.
2. Mark important local nodes with `data-ref`.
3. Read them inside `onMount(..., ctx)` using `ctx.refs`.
4. Register listeners, models, and effects there.
5. Register cleanup in one place.
6. Mount the component into a known host with `mount(component, host)`.

That pattern matters because it gives every subtree a clear owner.

## How To Think About Ownership

Before writing code, answer these questions:

### What owns the state?

If the state only matters to one mounted UI instance, keep it local in that component.

Examples:

- whether a panel is open
- a draft form value
- a local loading state
- a local error message

If several modules need it, it probably belongs in shared state or feature state.

### What owns the markup?

If the markup is a bounded UI surface, its module should define it locally with `template`.

Do not spread a small UI element across:

- shell HTML
- a random parent module
- a follow-up imperative patch step

### What owns mount and cleanup?

The module that registers listeners and effects should also own tearing them down.

Avoid “someone else will clean this up later” patterns.

## The Usual Flow For Adding UI

When you add a new UI element to a page, work in this order:

1. Decide whether it is page-level, feature-level, or component-level.
2. Identify the existing host where it should mount.
3. Create a bounded component with `template`.
4. Add local signals for local state.
5. Use `data-ref` for the nodes you need to touch.
6. Bind listeners, `model`, and `fx` in `onMount`.
7. Mount it from the page or feature that owns it.
8. Clean it up where it was mounted.

The main mistake to avoid is writing the markup in one place and the behavior in a second unrelated place.

## Worked Example: Add A Filter Panel To A Page

Assume you want to add a small “filter panel” to an existing page.

It should:

- open and close
- let the user type a filter query
- show a validation message when the query is too short
- notify the owning page or feature when the filter changes

### Step 1: Decide The Boundary

This should be a bounded component.

Why:

- it owns a small subtree
- it has local open state
- it has a draft input
- it needs local listeners and cleanup

The actual filtering behavior can still belong to the surrounding feature if that feature owns the data set.

### Step 2: Define The Public Surface

Start with a small function signature.

```js
/**
 * @param {{
 *   label: string,
 *   onFilterChange: (value: string) => void
 * }} options
 */
export function createFilterPanel(options) {
  // ...
}
```

Keep the surface small. Pass in what the component needs. Do not make it reach outward into unrelated state unless the surrounding feature explicitly owns that state.

### Step 3: Add Local State

```js
const open = signal(false);
const query = signal("");
const errorMessage = signal("");
const cleanup = cleanupCollector();
```

This is the default pattern for small local UI state.

### Step 4: Write The Markup

```js
const renderFilterPanel = template({
  root: ".filter-panel",
  onMount(_el, _parent, ctx) {
    // wiring goes here
  },
  onUnmount() {
    cleanup.run();
  },
});

return renderFilterPanel`
  <section class="filter-panel">
    <div class="filter-panel__header">
      <h3 class="filter-panel__title">${options.label}</h3>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-ref="toggleButton"
      >
        Toggle
      </button>
    </div>

    <div class="filter-panel__body" hidden data-ref="body">
      <input
        type="text"
        class="input"
        placeholder="Filter bookmarks"
        data-ref="queryInput"
      />
      <p class="error-text" hidden data-ref="error"></p>
    </div>
  </section>
`;
```

Two important rules:

- Use `data-ref` for elements the component will own.
- Keep the markup local to the module that owns the behavior.

### Step 5: Bind Refs In `onMount`

```js
onMount(_el, _parent, ctx) {
  const toggleButton = ctx.refs.toggleButton;
  const body = ctx.refs.body;
  const queryInput = ctx.refs.queryInput;
  const error = ctx.refs.error;

  if (!(toggleButton instanceof HTMLButtonElement)) {
    throw new Error("Expected filter toggle button");
  }
  if (!(body instanceof HTMLElement)) {
    throw new Error("Expected filter body");
  }
  if (!(queryInput instanceof HTMLInputElement)) {
    throw new Error("Expected filter query input");
  }
  if (!(error instanceof HTMLElement)) {
    throw new Error("Expected filter error element");
  }
}
```

Do the runtime type checks once, early, and close to the refs.

### Step 6: Bind Inputs With `model`

```js
const queryInputEl = queryInput;
const queryBinding = model(queryInputEl, query, { reactive: true });
```

Now the input value and the signal stay in sync.

### Step 7: Add Local Interaction

```js
function handleToggleClick() {
  open(!open());
}

function handleQueryInput() {
  const nextQuery = query().trim();

  if (nextQuery.length > 0 && nextQuery.length < 2) {
    errorMessage("Type at least 2 characters");
    return;
  }

  errorMessage("");
  options.onFilterChange(nextQuery);
}

toggleButton.addEventListener("click", handleToggleClick);
queryInputEl.addEventListener("input", handleQueryInput);
```

The rule here is simple:

- signals hold state
- event handlers update signals or call outward callbacks

### Step 8: Push State Into The DOM With `fx`

```js
cleanup.add(
  queryBinding.cleanup,
  fx(body, (currentBody) => {
    currentBody.hidden = !open();
  }),
  fx(error, (currentError) => {
    const message = errorMessage();
    currentError.hidden = message.length === 0;
    currentError.textContent = message;
  }),
  () => toggleButton.removeEventListener("click", handleToggleClick),
  () => queryInputEl.removeEventListener("input", handleQueryInput),
);
```

This is the key `naf` habit:

- the signal state changes first
- the UI follows through narrow bindings

Avoid large manual “rerender everything” logic.

### Step 9: Mount It From The Owning Page Or Feature

If the page owns it:

```js
const filterPanel = createFilterPanel({
  label: "Filter Results",
  onFilterChange(value) {
    searchState.actions.setQuery(value);
  },
});

mount(filterPanel, shell.someHost);
```

If a feature owns it, mount it from that feature instead.

The mounting module should also own the cleanup:

```js
return {
  cleanup() {
    filterPanel.unmount?.();
    shell.someHost.replaceChildren();
  },
};
```

## A Good Default Shape For New UI Modules

When in doubt, use this shape:

```js
export function createSomething(options) {
  const localState = signal(/* ... */);
  const cleanup = cleanupCollector();

  const renderSomething = template({
    root: ".something",
    onMount(_el, _parent, ctx) {
      // refs
      // listeners
      // model
      // fx/effect
      // cleanup.add(...)
    },
    onUnmount() {
      cleanup.run();
    },
  });

  return renderSomething`
    <section class="something">
      ...
    </section>
  `;
}
```

This is not the only valid pattern, but it is the most predictable one in this project.

## When To Use Local Signals vs Shared State

Use local signals when:

- the state belongs to one mounted instance
- the state is temporary UI state
- the state does not need to survive page switches

Use shared or feature state when:

- more than one module needs the value
- the value drives page choice or feature behavior
- the value represents product state, not local UI draft state

Examples of local state:

- panel open state
- inline form error
- local loading spinner
- current draft input

Examples of shared or feature state:

- current file path
- selected tree node
- active search query when it affects multiple surfaces
- import or move dialog workflows

## Common Mistakes

### Treating `template` As A String Builder

`template` is a component helper, not just a convenient way to write HTML.

Use it to localize markup ownership, refs, and lifecycle.

### Letting A Parent Reach Deep Into A Child

If a parent has to query deep into a child subtree to make it work, the child probably owns too little.

Prefer a clearer component boundary.

### Using One Giant `effect`

If one effect updates many nodes, classes, labels, and behaviors at once, split it into smaller `fx` bindings or rethink the module boundary.

### Mixing Several Ownership Styles In One Module

Avoid this combination in one new module:

- imperative DOM creation
- broad `querySelector` traversal
- raw HTML interpolation for dynamic text
- unrelated cleanup logic in a different module

Pick one clear ownership model and keep it local.

### Using Shared State Too Early

Do not promote local UI state to shared state just because several functions in one module use it.

Signals are cheap. Keep state local until there is a real cross-module need.

## Rules Of Thumb

- Pages compose. Features behave. Components own bounded UI.
- Reach for `template` first when adding a bounded surface.
- Reach for `signal` first when the state is local.
- Use `model` for form controls.
- Use `fx` for narrow DOM bindings.
- Use `effect` for coordination, not bulk rendering.
- Use one obvious cleanup path per mounted surface.
- If a module is hard to explain in one sentence, the boundary is probably wrong.

## What “Good” Looks Like In This Project

A good new UI module in this frontend should feel like this:

- the markup is local
- the important nodes are named with `data-ref`
- local state is small and explicit
- event handlers are short
- DOM bindings are narrow
- cleanup is centralized
- the mounting site is obvious

If a fresh engineer can open the module and answer:

- what it owns
- what state it owns
- where it mounts
- how it cleans up

then the module is shaped correctly.
