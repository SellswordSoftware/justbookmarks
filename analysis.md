# NAF Runtime & Frontend Architecture Review

## Context

justbookmarks is a Wails v2 desktop bookmark manager. The frontend uses vanilla JavaScript with a custom NAF runtime (~1078 lines) providing signals, computed, effects, templates, conditional rendering, keyed lists with virtual scrolling, and cleanup management. The goal was to limit frontend dependencies to reduce churn and constant updates, using NAF as the proof-of-concept for a system of reactivity, styles, and components.

**Codebase stats at time of review:**
- 59 JS files, 12,522 lines total
- 29 CSS files, 1,970 lines total
- 7 state modules, 6 using signals/actions/selectors/computed pattern
- 178 instanceof checks, 99 addEventListener calls, 91 removeEventListener calls
- 50 `.hidden` assignments, 54 `.textContent` assignments, 63 signal() calls

---

## What Works Well

### 1. The core philosophy is correct

Limiting frontend dependencies to avoid churn was the right call. NAF at ~1078 lines gives you signals, computed, effects, templates, conditional rendering, lists with virtual scrolling, and cleanup management. That is a complete runtime for a single-window desktop app.

### 2. Layer separation is clean and consistent

The app/pages/features/components/layouts/shared split is well-executed. Files are easy to find, responsibilities are clear, and the naming conventions (`*-page.js`, `*-state.js`, `*-dialog.js`) make navigation mechanical.

### 3. The signal/computed/effect implementation is solid

Pure, minimal, correct. Lazy computed evaluation with dependency tracking, effect cleanup, no framework baggage. This is the strongest part of NAF.

### 4. The `list()` function is excellent

Keyed diffing with DOM reuse, virtual scrolling support, and per-item signal wrapping for reactivity. The pattern of passing HTML string constants directly to `list()` instead of `template()` is smart and documented well.

### 5. CSS architecture is lean

1,970 lines total. Token/primitive/component separation. No framework CSS overhead. Theme support via CSS variables. This is one of the best-executed parts.

### 6. Web workers for heavy computation

Tree normalization and search indexing run off-thread. Good instinct for a bookmark manager that may handle thousands of items.

### 7. `cleanupCollector()` is a great addition

Solves the real problem of tracking many cleanup functions without nesting. Used in 14 places.

---

## The Pain Points

### 1. Event listener management is the #1 boilerplate problem

99 addEventListener calls, 91 removeEventListener calls. Every single one requires manual pairing. In `bookmark-detail.js` alone, there are 19 event listeners that must be explicitly removed in cleanup. This is error-prone, tedious, and dominates the onMount surface area.

The `cleanupCollector` helps collect them but does not reduce the ceremony of writing `() => el.removeEventListener(...)` for every listener.

**Suggestion for NAF:** Add a `listener()` helper:

```js
export function listener(el, event, handler) {
  el?.addEventListener(event, handler);
  return () => el?.removeEventListener(event, handler);
}
```

This turns:
```js
el.addEventListener("click", handleClick);
cleanup.add(() => el.removeEventListener("click", handleClick));
```
Into:
```js
cleanup.add(listener(el, "click", handleClick));
```

### 2. Hidden state toggling is incredibly verbose

50 `.hidden =` assignments across the codebase. Most of them are binary toggles based on a single signal (editing vs not editing). In `bookmark-detail.js`, roughly half the `fx()` calls just toggle `.hidden` based on `editing()`:

```js
fx(titleInput, (el) => { el.hidden = !editing(); }),
fx(urlInputWrap, (el) => { el.hidden = !editing(); }),
fx(saveButton, (el) => { el.hidden = !editing(); }),
// ... 10 more like this
```

**Suggestion for NAF:** Add `show()` / `hide()` helpers:

```js
export function show(el, condition) {
  return effect(() => { if (el) el.hidden = !condition(); });
}
export function hide(el, condition) {
  return effect(() => { if (el) el.hidden = condition(); });
}
```

### 3. The onMount validation boilerplate is enormous -- [RESOLVED]

**RESOLVED via `requireRef()` and `requireElement()` helpers in NAF runtime.**

Every template component used to do exhaustive instanceof checks before accessing refs. In `bookmark-detail.js`, the onMount function was ~240 lines, and ~35 of those lines were just `if (!(ref instanceof Type)) throw new Error(...)`. With 178 instanceof checks across 59 files, this was a real tax.

Two helpers were added to `frontend/src/shared/runtime/naf.js`:

- `requireRef(refs, name)` -- replaces the 3-line ctx.refs + instanceof pattern in template onMount callbacks
- `requireElement(root, selector, description)` -- replaces the querySelector + instanceof pattern in collectShell functions

Migration covered:
- Phase 2: 12 files (template onMount refs) -- ~106 checks reduced from ~318 lines to ~106 lines
- Phase 3: 8 files (shell collection) -- ~14 checks reduced from ~42 lines to ~14 lines
- Non-candidates (runtime guards, list setup callbacks, NAF internal): ~18 checks unchanged

Expected reduction: ~360 lines -> ~120 lines (67% reduction in validation boilerplate).

See `painpoint3.md` for the full migration log.

### 4. State module pattern inconsistency

The architecture docs explicitly say "do not reintroduce broad selectors/actions/signals wrapper namespaces" but every feature state module uses exactly this pattern:

```js
export const treeState = {
  signals: { tree, loading, ... },
  computed: { selectionCount, ... },
  actions: { selectSingle, toggleExpand, ... },
  selectors: { getNode, getVisibleNodeEntries, ... },
};
```

Meanwhile `app-state.js` and `save-state.js` use a flatter domain-group pattern. Pick one and be consistent. The feature modules' pattern is actually useful -- it provides clear read vs write boundaries and prevents accidental signal mutation from outside the module. Consider embracing it formally in the docs.

### 5. `tree-state.js` at 1017 lines is too big

It owns tree data, selection logic, expansion state, loading workflows, persistence, search index coordination, and flat-tree conversion. The maintainability guidelines say 600+ lines needs justification. This one has it -- the tree is the core domain -- but it could benefit from splitting:

- Selection logic (already in `selection.js` but tightly coupled)
- Persistence (already in `persistence.js`)
- The async load/restore workflows could be extracted

### 6. The `when()` implementation is clever but fragile

Comment markers, tree walkers, slot IDs, end markers -- it works, but the mental model is complex. If something goes wrong, debugging reactive conditional rendering inside comment boundaries is going to be painful. The error messages are good ("Could not find placeholder comments") but the surface area for subtle bugs is large.

### 7. Move dialog uses querySelector inside `list()` setup

```js
const toggle = el.querySelector('[data-ref="toggle"]');
const folderIcon = el.querySelector('[data-ref="folderIcon"]');
```

This defeats the purpose of `data-ref`. The tree row module uses direct child access (`row.children[0]`), which is faster but fragile. Neither approach is ideal. The `data-ref` attribute is defined but never used by `list()` -- it is only meaningful for `template()` components that go through `collectRefs()`.

**Suggestion:** Either make `list()` support `data-ref` collection per row, or document that `data-ref` in list templates is just a naming convention, not a functional feature.

---

## Where NAF Can Be Expanded

### High-value additions (reduce real repetition)

1. **`listener(el, event, handler)`** -- As described above. Would eliminate ~90 lines of boilerplate cleanup code.

2. **`show(el, condition)` / `hide(el, condition)`** -- Would eliminate ~50 lines of `.hidden =` assignments.

3. **`classes(el, getter)`** -- For toggling multiple classes reactively:
   ```js
   classes(row, () => ({
     "is-selected": selected,
     "is-primary": primary,
     "is-expanded": expanded,
   }));
   ```

4. **`text(el, getter)`** -- Already exists as `setText()` but the name is inconsistent with `attr()`. Consider `text()` as the primary name.

5. **`style(el, getter)`** -- For reactive inline styles:
   ```js
   style(row, () => ({ paddingLeft: `${depth * 16}px` }));
   ```

### Lower-value (nice to have)

6. **`html(el, getter)`** -- Reactive innerHTML for cases where `raw()` is not enough.

7. **`children(host, getter)`** -- Clear and replace children reactively (like `when()` but simpler).

---

## Patterns That Should Be Addressed Differently

### 1. The "effect-per-element" pattern in list rows

Every list row creates its own `effect()` via `fx()` that re-runs whenever any dependency changes. For large lists, even with virtual scrolling, this means many concurrent effects. The current approach works because the effects are cheap (just DOM property assignments), but it is worth monitoring.

### 2. Manual scroll sync is fragile

The `syncingScrollFromState` flag pattern in `bookmark-tree.js` works but is a classic race-condition waiting to happen. A `requestAnimationFrame` guard helps but does not eliminate the problem entirely.

### 3. The `collectShell` / `mount` two-phase pattern adds ceremony -- [RESOLVED]

**RESOLVED by merging shell collection into `mountXxx(root)` entrypoints.**

The extra `collectXxxShell()` layer has been removed from the affected modules and callers now invoke mount functions directly with the root node. Stable DOM anchors are resolved inside each mount function with `requireElement()`, which keeps validation local without a separate shell-construction phase.

This simplified the public module surface, removed mechanical caller wrapping, and left the app-level `AppShell` pattern intact where it is still useful.

### 4. No dev mode debugging

When signals fire unexpectedly or effects cascade, there is no way to trace what is happening. A `debug` flag on signals that logs access/mutation would save hours during complex reactive bugs.

---

## Overall Assessment

**What is genuinely good:** The architecture is thoughtful, the layering is clean, the runtime is minimal and correct, and the CSS is well-managed. The decision to avoid a framework was validated by this codebase -- it works.

**The real cost:** The DOM binding layer is verbose. For every reactive UI element, you need `fx()` + an effect callback + manual DOM manipulation. In a framework like Svelte or React, this is declarative. In NAF, it is imperative but reactive. The trade-off is explicit: you get full control and zero framework overhead, but you pay in boilerplate.

**The biggest opportunity:** NAF could reduce ~30-40% of the onMount boilerplate with a few targeted helpers (listener, show/hide, classes). That would make template-backed components significantly more pleasant to write without adding framework complexity.

**The honest answer to "can this be improved":** Yes, but the improvements are incremental. The architecture is sound. The pain points are all in the binding layer -- mechanical, not conceptual. Adding 5-8 small helpers to NAF would address most of the repetition without changing the fundamental approach. The project is a successful proof of concept; it just needs the runtime to catch up to the patterns the codebase has already discovered.
