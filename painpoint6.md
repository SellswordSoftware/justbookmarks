# Pain Point #6: when() is Clever but Fragile

## Current Implementation

The `when()` function (lines 1066-1123 in naf.js) implements reactive conditional
rendering using a multi-layer approach:

1. **reactiveSlot()** - Creates a unique slot ID and generates comment markers
   `<!--naf-X--><!--/naf-X-->` as placeholder HTML.

2. **TreeWalker on mount** - Walks all comment nodes in the parent to find the
   matching start/end markers for this slot ID.

3. **Effect-based branching** - An effect watches the condition signal. When it
   changes, it unmounts the old component and mounts the new one.

4. **updateSlotContent()** - Finds content between comment markers by walking
   siblings until it finds the end marker `/naf-X`, removes all nodes between
   the markers, then inserts new HTML.

5. **Nested when()** - Creates additional span elements with `data-naf-when-slot`
   attributes as sub-slots inside the comment-marked region.

## Current Usage

Only one usage site in the entire codebase: `detail-panel.js`.

It uses nested `when()` for a 3-way branch:
- selectionCount > 1 -> bulk selection detail
- single node selected -> single item detail (bookmark or folder)
- nothing selected -> empty state

## Problems

### 1. Comment markers are fragile

HTML comments can be accidentally removed by:
- DOM manipulation outside NAF's control (browser extensions, devtools)
- innerHTML assignments that strip comments
- Copy-paste operations in development

If a comment marker is lost, the error message is:
`Could not find placeholder comments: naf-X`

This tells you nothing about which `when()` block failed or where it lives.

### 2. TreeWalker adds unnecessary complexity

On every mount, `reactiveSlot()` creates a TreeWalker over ALL comment nodes
in the parent element. This is:
- Overkill for finding two comments that were just inserted
- A performance concern if the parent has many comment nodes
- Hard to reason about during debugging

### 3. updateSlotContent() is a tree-walking mutation bomb

Every time the condition changes:
1. Walk siblings from start marker to find end marker
2. Walk siblings again to remove all nodes between markers
3. Parse new HTML into a temp div
4. Insert new nodes before the end marker

This is correct but verbose and hard to follow in a debugger. A simple
`container.replaceChildren()` or `container.innerHTML = ''` would be clearer.

### 4. Nested when() creates invisible DOM soup

When `when()` is nested (as in detail-panel.js), the inner `when()` creates:
- Its own comment markers inside the outer `when()`'s region
- Its own slot ID and span elements
- A querySelector call to find the inner span

The resulting DOM structure is:
```
<span data-naf-component-slot="1">          <!-- outer when() slot -->
  <span data-naf-when-slot="2">             <!-- outer when() branch -->
    <!--naf-3-->                             <!-- inner when() start -->
    <span data-naf-when-slot="4">           <!-- inner when() branch -->
      ... actual content ...
    </span>
    <!--/naf-3-->                            <!-- inner when() end -->
  </span>
</span>
```

This is hard to inspect in devtools and nearly impossible to debug visually.

### 5. The mental model is complex

To understand `when()`, you need to know:
- reactiveSlot() creates comment markers
- slotId is a global counter
- TreeWalker finds the markers on mount
- updateSlotContent() walks siblings to find boundaries
- when() creates a secondary span with data-naf-when-slot for the actual component
- The effect compares previousBranch and previousValue to avoid re-renders

That is 6 interconnected concepts for what should be "show A or B based on a condition."

### 6. Error messages are not actionable

Three error messages, none of which identify the offending `when()`:
- "Reactive slot placeholder is not attached to an element parent"
- "Could not find end marker for reactive slot naf-X"
- "Could not find placeholder comments: naf-X"
- "Reactive slot host not found"

There is no way to add labels, descriptions, or source locations.

### 7. The reactiveSlot abstraction leaks

`reactiveSlot()` is an internal function but its pattern (comment markers,
TreeWalker, sibling walking) is shared with `updateSlotContent()`. If someone
wants to build a similar reactive primitive (e.g., `for()` for reactive lists
in templates), they would need to understand and potentially reuse this pattern.

## Brainstorm: Approaches

### Approach A: Simplify when() - Direct slot mounting (Recommended)

**Idea**: `when()` returns a component with empty HTML. On mount, the parent
IS the slot host - mount/unmount components directly into it. No comment
markers, no TreeWalker, no updateSlotContent.

**How it works**:
- `when()` returns `{ html: '', refs: {}, mount(parent), unmount() }`
- `mount(parent)` sets up an effect that watches the condition
- When the condition changes: unmount old component, clear parent, mount new component
- `unmount()` stops the effect and unmounts the current component

**Benefits**:
- Eliminates reactiveSlot, updateSlotContent, TreeWalker entirely (~60 lines)
- No comment markers to lose
- No sibling walking
- Debugging: the parent element IS the when() container - visible in devtools
- Error messages can reference the parent element

**Cost**:
- Breaking change to internal implementation only (API stays the same)
- Need to verify it works when composed inside template()

**Sketch**:
```js
export function when(condition, thenBranch, elseBranch) {
  let currentComponent;
  let previousValue;
  let previousBranch;

  return {
    html: '',
    refs: {},
    mount(parent) {
      const stop = effect(() => {
        const value = condition();
        const branch = Boolean(value);

        if (previousBranch === branch && previousValue === value) return;
        previousBranch = branch;
        previousValue = value;

        currentComponent?.unmount?.();
        currentComponent = branch ? thenBranch(value) : elseBranch?.(value);

        if (currentComponent) {
          parent.replaceChildren();
          currentComponent.mount(parent);
        }
      });
    },
    unmount() {
      currentComponent?.unmount?.();
    },
  };
}
```

**Lines removed**: ~60 (reactiveSlot, updateSlotContent, and when() simplification)
**Lines added**: ~25 (simplified when())
**Net reduction**: ~35 lines

### Approach B: Replace when() with effect-based branching

**Idea**: Remove `when()` entirely. Users who need conditional rendering use
a simple effect pattern directly.

**How it works** (detail-panel.js example):
```js
let currentDetailComponent;

const stop = effect(() => {
  const count = treeState.computed.selectionCount();
  const nodeId = treeState.selectors.getSelectedNodeId();
  const node = nodeId ? treeState.selectors.getNode(nodeId) : null;

  currentDetailComponent?.unmount?.();

  if (count > 1) {
    currentDetailComponent = createBulkSelectionDetail();
  } else if (node) {
    currentDetailComponent = isFolderNode(node)
      ? createFolderDetail(node)
      : createBookmarkDetail(node);
  } else {
    currentDetailComponent = createDetailEmptyState();
  }

  shell.content.replaceChildren();
  currentDetailComponent.mount(shell.content);
});
```

**Benefits**:
- Zero abstraction - the code does exactly what it says
- Multi-way branching is natural (if/else if/else)
- No nested when() needed
- Easy to debug - the effect body IS the branching logic
- No reactiveSlot, no comment markers, no TreeWalker

**Cost**:
- Removes `when()` as a primitive - loses the declarative template composition
- Slightly more verbose for simple two-way branches
- The effect owns the DOM directly (less separation)

**Verdict**: Good for this codebase where `when()` has only 1 usage site.
The effect pattern is actually clearer for the detail-panel use case.

### Approach C: Add switch() for multi-way branching

**Idea**: Keep `when()` for simple true/false branches, add `switch()` for
multi-way branching based on a discriminator value.

**API**:
```js
switch(
  () => getDiscriminator(),          // signal that returns a value
  {                                  // branch map
    bulk: () => createBulkSelectionDetail(),
    single: () => renderSingleSelection(node),
    empty: () => createDetailEmptyState(),
  }
)
```

**Benefits**:
- Addresses the nested-when() problem directly
- Flat structure instead of nesting
- Clear branch names serve as documentation

**Cost**:
- New primitive to learn
- Still has the comment marker / TreeWalker problem
- Adds runtime surface area

**Verdict**: Nice API but doesn't solve the underlying fragility of
reactiveSlot. Better to fix when() first (Approach A), then consider
switch() as an enhancement.

### Approach D: Hybrid - Simplify when() + Document the effect pattern

**Idea**: Simplify when() using Approach A (direct slot mounting). Document
that for multi-way branching, the effect pattern is often clearer.

**Guidelines update**:
```md
### Use `when()` for simple two-way branches in templates

Good uses:
- loading vs loaded state
- empty vs populated state
- show/hide a single component

### Use effect() for multi-way branching

When you have 3+ branches or complex conditions, an explicit effect
is clearer than nested when():

effect(() => {
  const mode = getMode();
  currentComponent?.unmount?.();
  currentComponent = mode === 'a' ? componentA : componentB;
  host.replaceChildren();
  currentComponent?.mount(host);
});
```

**Benefits**:
- Fixes the fragility of when()
- Guides users toward the clearest pattern for their use case
- No new primitives to learn

## Recommendation

**Phase 1: DONE** - Simplify when() to use direct slot mounting.
This is a mechanical change with no API breakage. Removed ~90 lines and
eliminated all the comment marker / TreeWalker complexity.

**Phase 2: DONE** - Migrate detail-panel.js from nested when() to an explicit
effect pattern. The 3-way branch is clearer with plain if/else if/else, and
the meta text update was consolidated into the same effect (one effect instead
of two).

**Phase 3: DONE** - Updated documentation:
- `docs/naf-html-usage-guidelines.md` - expanded when() section with examples,
  added "Use an explicit effect for multi-way branching" section
- `docs/agent-project-context.md` - noted when() is for two-way branches only
- `docs/frontend-architecture.md` - same note added to runtime model section

## Questions to Consider

1. Is when() used anywhere outside the current codebase that we don't know about?
   Search shows only 1 usage site.

2. Should when() support an optional label for better error messages?
   e.g., `when(condition, then, else, { label: 'detail branch' })`

3. Should we keep reactiveSlot as an internal primitive for future use?
   It could power a `for()` reactive list in templates, but that overlaps with list().

4. Does the simplified when() work correctly when composed inside template()?
   The template system calls `childSlot.component.mount(slotHost)` where slotHost
   is a span with `data-naf-component-slot`. The simplified when() would mount
   directly into that span. This should work - the span has `display: contents`
   so it doesn't affect layout.
