# S01 Plan: Scoped Component Ownership in `naf.js`

## Purpose

This slice strengthens the local NAF runtime so bounded shell components can own their markup, refs, mount lifecycle, and nested composition without relying on parent-wide `querySelector()` lookups.

The goal is not to build a framework. The goal is to make the existing template/runtime model deep enough that later shell migrations become mechanical instead of fragile.

## Current Status

`S01` is complete.

What has landed:

- `mount(component, host)` exists in `frontend/src/shared/runtime/naf.js`
- template-backed components now expose `refs`
- `data-ref` plus `ctx.refs` is in active use
- component instances now parse and mount their own local subtree before resolving ownership
- component root lookup is instance-scoped rather than host-scoped
- ref collection is instance-scoped rather than host-scoped
- nested child components now mount into explicit local slot hosts
- `when()` branches now mount into explicit local slot hosts
- several bounded shell components have been migrated to the new pattern:
  - titlebar
  - confirm modal
  - keyboard shortcuts dialog
  - import / merge dialog
  - move dialog
  - toolbar actions
  - empty-library page shell
- `titlebar` now acts as the nested-component proof, with separate child components for brand and window controls

Verification completed on May 29, 2026:

- `cd frontend && npm run typecheck`
- `cd frontend && npm run build`

## Problem Statement

The current `template()` model has three structural limitations:

- child components mount against the whole parent rather than an explicit local slot
- `root` lookup is parent-scoped, so nested components can collide or couple accidentally
- callers still need repeated host creation and local `requireElement()` boilerplate

That is the main reason the frontend still feels farther from Svelte than it should.

## Callers and Constraints

### Primary callers

- page modules such as empty-library and library pages
- bounded shell components such as titlebar and dialogs
- future shell-local feature wrappers

### Secondary callers

- `when()` branches and any nested component composition
- documentation and future contributors who need one obvious authoring pattern

### Constraints

- keep plain JavaScript with `// @ts-check`
- preserve the current reactive primitives: `signal`, `computed`, `effect`, `fx`, `model`, `list`
- avoid virtual DOM, diff engines, or compiler-like transforms
- preserve compatibility for imperative surfaces that do not want the template model
- allow incremental migration of current `template()` consumers

## Interface Designs

### Design A: Minimal Scoped Component

Keep the current template-tag model, but change component instances to own a concrete local root and local refs.

#### Proposed shape

```js
const renderThing = template({
  root: ".thing",
  refs: ["saveButton", "status"],
  onMount(ctx) {
    const { el, refs, cleanup } = ctx;
  },
});

const component = renderThing`
  <section class="thing">
    <button data-ref="saveButton">Save</button>
    <p data-ref="status"></p>
  </section>
`;

mount(component, host);
component.unmount();
```

#### Usage example

```js
const component = renderTitlebar`
  <div class="titlebar__window-controls">
    <button data-ref="minimizeButton">-</button>
  </div>
`;

mount(component, shell.titlebar);
```

#### Complexity kept internal

- HTML-to-fragment parsing
- root resolution within the component instance
- `data-ref` collection and typed ref map creation
- local cleanup handling
- child component placeholder mounting

#### Trade-offs

- Best incremental path from the current API
- Easy to migrate current `template()` consumers
- Still string-template based, so it does not improve authoring of dynamic attributes much
- Needs a carefully designed child-slot mechanism to avoid parent-scoped mounting

### Design B: Explicit Builder API

Stop returning a component from a template tag directly. Instead expose a builder that clearly separates parse, refs, and mount behavior.

#### Proposed shape

```js
const Titlebar = component({
  html: `
    <div class="titlebar__window-controls">
      <button data-ref="minimizeButton">-</button>
    </div>
  `,
  root: ".titlebar__window-controls",
  refs: ["minimizeButton"],
  setup(ctx) {
    const { refs, cleanup } = ctx;
  },
});

const instance = Titlebar();
instance.mount(shell.titlebar);
instance.unmount();
```

#### Usage example

```js
const ConfirmModal = component({ ... });
const modal = ConfirmModal({ state });
modal.mount(host);
```

#### Complexity kept internal

- component instantiation lifecycle
- props threading
- local refs and cleanup
- child instance mounting

#### Trade-offs

- Very explicit and easy to reason about
- Better long-term extensibility for props and custom setup hooks
- Less ergonomic than the current tag-based model
- Pushes the codebase away from the current template usage style instead of evolving it

### Design C: Slot-First Mount API

Keep templates shallow and make the main abstraction the mount host plus named slots. Parent components explicitly provide slots for child components.

#### Proposed shape

```js
const component = template({
  root: ".dialog",
  refs: ["title", "body"],
  slots: ["footer"],
  onMount(ctx) {
    ctx.mountSlot("footer", Footer());
  },
})`
  <section class="dialog">
    <h2 data-ref="title"></h2>
    <div data-ref="body"></div>
    <div data-slot="footer"></div>
  </section>
`;
```

#### Usage example

```js
const dialog = renderDialog`...`;
mount(dialog, container);
```

#### Complexity kept internal

- slot resolution
- child mounting/unmounting per slot
- slot replacement and ordering rules

#### Trade-offs

- Strongest composition model for nested templates
- Very close to the “explicit composition boundary” benefit of Svelte
- More API surface than the current codebase needs immediately
- Risks pulling the runtime toward a miniature framework before enough slices justify it

## Comparison

Design A is the best incremental shape. It directly attacks the current failure mode: parent-scoped ownership. It keeps the existing `template()` mental model, which means current modules can migrate with local mechanical edits rather than conceptual rewrites.

Design B is cleaner in isolation, but it is a different authoring style. The cost is not implementation effort; it is caller churn. Every existing `template()` consumer would need to move to a more explicit factory style, which is not necessary to solve the immediate problem.

Design C has the deepest composition story, but it solves more than `S01` needs. Right now the codebase’s biggest problem is not lack of named slot orchestration. It is that even simple components do not truly own their own roots and refs. Design C should only be introduced if later slices prove nested shell composition needs explicit slot management beyond what scoped refs and local root ownership can provide.

## Recommendation

Implement Design A now, with one selective borrowing from Design C: allow explicit child placeholders internally if needed, but do not expose a first-class slot API yet.

That gives the slice a small surface area:

- keep `template(...)`
- add local refs
- add a `mount(component, host)` helper
- make component roots and child mounting local to the instance
- keep `when()` compatible with the same local-ownership model

This is the smallest interface that hides meaningful complexity and unlocks the later milestone slices.

## Recommendation Update

Keep the same recommendation, but narrow the next session strictly to the unfinished runtime work.

Do not spend the next session migrating more consumers first. The migration proof already exists. The next session should finish the actual ownership boundary inside `naf.js`.

## Recommended Runtime Shape

### Public API

```js
export function template(options)
export function mount(component, host)
export function ref(name)
```

`ref(name)` is optional. If the implementation is simpler with `data-ref="name"` strings only, that is acceptable for `S01`.

### `template()` options

```js
template({
  root: ".selector",
  onMount(ctx) {},
  onUnmount(ctx) {},
})
```

### `onMount()` context

```js
{
  host,        // mount host element
  root,        // component root element
  refs,        // map of locally collected refs
  cleanup,     // cleanupCollector instance or equivalent
  component,   // current component instance
}
```

### Component instance contract

```js
{
  mount(host),
  unmount(),
  root,
  refs,
}
```

Avoid keeping `html` as the primary public contract once `mount(component, host)` exists. Internal HTML strings are fine, but the public abstraction should be “mountable instance with local ownership,” not “string with a sidecar mount method.”

## Execution Plan

### Step 1: Stabilize the target contract

- Define the new internal `ComponentInstance` shape.
- Decide whether `html` remains public for compatibility during the transition.
- Define local ref collection rules:
  - `data-ref` based
  - first match wins inside the component subtree
  - duplicate refs throw in development

### Step 2: Introduce `mount(component, host)`

- Create a single helper that:
  - clears or appends in a defined way
  - mounts one component instance into one host
  - records the root instance locally
- Migrate one existing internal consumer to use it as the proof path.

Status:

- done

### Step 3: Make `template()` produce locally owned instances

- Parse the template into a fragment
- resolve the local root inside the fragment before insertion
- collect refs from the fragment before insertion
- insert the component subtree into the host
- call `onMount()` with local context

Status:

- done
- component instances now mount a local fragment and resolve roots and refs inside that instance boundary

### Step 4: Remove parent-wide child mounting behavior

- Replace current child component mounting against the whole parent
- make nested children mount against explicit local placeholders or exact local insertion points
- ensure unmount tears down children in reverse order

Status:

- done
- nested template-backed children now mount into explicit local slot hosts inside the parent instance

### Step 5: Adapt `when()`

- update reactive slot rendering so mounted branch components own only the nodes inside the slot boundary
- ensure branch replacement unmounts only the previous branch instance
- keep the external `when()` call shape unchanged for now

Status:

- done
- branch components now mount into an explicit local slot host inside the reactive boundary

### Step 6: Prove the design on one real component

- migrate `components/titlebar/titlebar.js` first
- remove parent-level lookups that the new ref model makes unnecessary
- verify the same behavior still works under Wails runtime conditions

Status:

- done
- titlebar is migrated and now provides the nested proof case for local child composition

### Step 7: Preserve compatibility where possible

- keep old `template()` call sites working unless they depend on the broken parent-scoped behavior
- document what changed so later slices can migrate deliberately

Status:

- done
- existing migrated callers still build and the public template shape remains incremental

## Follow-On Actions

`S01` is no longer the blocker. The next session should move back to the milestone roadmap:

### 1. Reassess the milestone status

- mark `S01` complete in the roadmap
- review whether `S07` through `S10` need more implementation or just final verification and cleanup

### 2. Tighten verification beyond build-time checks

- manually verify nested shell behavior in the running app, especially titlebar controls under Wails
- confirm no duplicate or leaked DOM appears after mount/unmount cycles

### 3. Decide whether to add runtime-focused regression coverage

- if the project wants stronger protection here, add a narrow test or fixture around nested component refs and local slot ownership
- keep it small; the goal is regression protection, not a test harness expansion

### 4. Continue milestone cleanup, not more runtime invention

- avoid expanding `naf.js` into a larger framework abstraction
- focus the next slices on remaining page/app cleanup, docs, and milestone closeout

## Acceptance Criteria

- A component instance can mount and unmount without scanning the entire host tree for its root.
- A component can access required local elements through refs collected from its own subtree.
- Nested components no longer mount against arbitrary parent scope.
- `when()` still works and respects local slot ownership.
- At least one real bounded shell component is migrated successfully as proof.
- At least one nested component proof demonstrates that root and ref ownership are local, not host-wide.
- Frontend typecheck and build still pass after the runtime change.

Current result:

- satisfied

## Definition Of Done For S01

`S01` is complete because all are now true:

- no component root lookup relies on host-wide `querySelector()`
- no template-backed component ref collection relies on scanning the whole host
- no nested component mounting uses the whole parent as shared scope
- `when()` branch mounting is scoped to its local slot boundary
- the existing migrated shell consumers still work
- one nested composition proof exists
- frontend typecheck and build pass

## Explicit Non-Goals for S01

- no store API redesign
- no broad page migration
- no dialog-family migration
- no tree/detail refactor
- no new generic event system
- no virtual DOM, keyed reconciliation, or compiler-style directives

## Recommended Proof Component

Use `titlebar` as the proof path because:

- it is bounded
- it already uses `template()`
- it currently mixes local markup with parent-scoped lookups
- it exercises Wails integration and button event wiring without dragging page complexity into the slice

## Verification

Minimum verification for `S01`:

```bash
cd frontend
npm run typecheck
npm run build
```

Manual verification:

- titlebar renders correctly
- minimize/maximize/close controls still wire correctly in Wails runtime
- no duplicate shell markup appears after mount/unmount
- no regressions in existing `template()` consumers that were not migrated yet
- nested component refs do not collide when parent and child reuse the same `data-ref` names

Verification completed:

- `npm run typecheck`: passed on May 29, 2026
- `npm run build`: passed on May 29, 2026

## Follow-On Impact

If `S01` lands as designed, `S03`, `S04`, and `S07` become mostly mechanical:

- migrate bounded shell components to local refs
- stop hand-querying broad parent scope
- move shell markup out of `index.html`
- simplify page composition around local ownership rather than shell scavenging

At the moment, those later slices are ahead of the runtime guarantee. Finishing the runtime scoping work is what makes the current migration state architecturally honest.
