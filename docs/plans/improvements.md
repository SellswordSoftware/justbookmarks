# Frontend Review Improvements

## Scope

Reviewed the current vanilla frontend against `docs/plans/frontend-vanilla-naf-agent-brief.md`, with extra attention on `frontend/src/lib/naf-html.js`, tree/state wiring, and feature-module structure.

## Verification

- `npm run build` in `frontend/`: passed
- `go test ./...`: passed

## Findings

### HIGH: Per-file tree state restore exists, but persistence writes are not wired

**Files**:
- `frontend/src/app.js:186-192`
- `frontend/src/lib/persistence.js:159-172`
- `frontend/src/lib/state/tree-state.js:651-655`
- `docs/plans/frontend-vanilla-naf-agent-brief.md:69-70`

**Issue**: The app restores per-file tree state on load, but nothing writes updated tree UI state back to persistence. `setPerFileTreeState()` exists, and `treeState.selectors.getPersistentState()` exists, but neither is used anywhere.

**Why it matters**: The brief explicitly calls out per-file tree state persistence. In practice, expanded folders and selection will not survive reopening a file, so this is a parity gap rather than a cleanup opportunity.

**Suggestion**: Persist `treeState.selectors.getPersistentState()` whenever the current file path, expanded node set, or primary selection changes. The cleanest place is an app-level effect that no-ops until a file is loaded.

### HIGH: Drag-and-drop move/reorder appears to be missing from the tree UI

**Files**:
- `frontend/src/lib/features/tree-node.js:35-150`
- `frontend/src/lib/features/bookmark-tree.js:60-397`
- `frontend/src/lib/api.js:215-224`
- `docs/plans/frontend-vanilla-naf-agent-brief.md:60`

**Issue**: The tree surface handles click and keyboard interaction, but there are no drag event handlers on tree rows or the tree container. The backend API still exposes `MoveNode`, so the data path exists, but the frontend path is absent.

**Why it matters**: The brief requires drag-and-drop move/reorder parity. This is user-visible missing functionality, not just an internal structural concern.

**Suggestion**: Add explicit drag source and drop target semantics in the tree modules, then route accepted drops through `MoveNode`. This should likely live beside `mountTreeNode()` and `mountBookmarkTree()` so the interaction stays co-located with tree rendering/state.

### MEDIUM: `computed()` does not unsubscribe from stale dependencies

**File**: `frontend/src/lib/naf-html.js:81-103`

**Issue**: `computed()` subscribes `markDirty` to whatever signals were read during the last evaluation, but it never removes old subscriptions when the dependency set changes. A conditional computed such as `flag() ? a() : b()` will remain subscribed to both branches over time.

**Why it matters**: This creates unnecessary invalidations and can accumulate stale subscriptions. Right now the app mostly uses simple computeds, but this is a correctness gap in the helper runtime itself.

**Suggestion**: Track subscribed dependency sets inside `computed()` the same way `effect()` does, clearing old subscriptions before recomputing.

### MEDIUM: `effect()` can leave the reactive runtime in a broken state if the callback throws

**File**: `frontend/src/lib/naf-html.js:112-144`

**Issue**: `effect()` mutates `activeSub`, `activeSets`, and `running`, then calls `fn()` without a `try/finally`. If `fn()` throws, the globals are not restored and `running` stays `true`.

**Why it matters**: One unexpected DOM/runtime error can poison later reactive work, making follow-on bugs difficult to diagnose.

**Suggestion**: Wrap the `fn()` invocation in `try/finally` and always restore `activeSub`, `activeSets`, and `running`.

### MEDIUM: `model()` is not usable within the project’s cleanup pattern

**File**: `frontend/src/lib/naf-html.js:229-259`

**Issue**: `model()` attaches an event listener and optionally creates an effect, but returns only the element. There is no way to remove the listener or stop the internal effect.

**Why it matters**: The rest of the frontend consistently returns cleanup functions from mounted features. If `model()` starts being used more broadly, it will introduce listener/effect leaks and make remounting harder.

**Suggestion**: Change `model()` to return a cleanup function or an object like `{ el, cleanup }`, and align it with the lifecycle contract used elsewhere in the codebase.

### MEDIUM: The migration still relies on Vite

**Files**:
- `frontend/package.json:5-12`
- `docs/plans/frontend-vanilla-naf-agent-brief.md:22-28`

**Issue**: The brief says the rewrite should remove reliance on Vite, but the frontend still uses Vite for `dev`, `build`, and `preview`, and keeps it as the only frontend build dependency.

**Why it matters**: If the migration is being judged against the brief, this is an incomplete architectural outcome.

**Suggestion**: Either remove the Vite dependency and replace it with the intended Wails-compatible flow, or explicitly amend the plan/brief to say Vite remains a deliberate build tool even though Svelte/Tailwind/DaisyUI were removed.

### LOW: The `naf-html` surface is larger than the portion the app actually uses

**Files**:
- `frontend/src/lib/naf-html.js`
- imports across `frontend/src/app.js` and `frontend/src/lib/features/*.js`

**Issue**: In practice the app uses `signal`, `computed`, `effect`, `list`, `$`, and `fx`. Helpers such as `model`, `text`, `$on`, `$$`, and `cleanupCollector` are either unused or barely integrated into the feature modules.

**Why it matters**: Unused runtime surface increases maintenance cost, especially when some of that surface has lifecycle gaps.

**Suggestion**: Either trim the helper API to the subset the app genuinely uses, or refactor modules to adopt the helpers consistently enough that the abstraction earns its weight.

### LOW: Frontend behavior has no automated test coverage

**Files**:
- `frontend/src/**`
- `frontend/package.json`

**Issue**: There are no frontend test files, and the current verification path is limited to a production build plus Go backend tests.

**Why it matters**: The highest-risk migration areas called out in the brief are tree selection, keyboard navigation, drag/drop semantics, and focus behavior. Those are exactly the areas most likely to regress without UI-focused tests.

**Suggestion**: Add a small test layer around tree state and keyboard behavior first. Even a narrow set of state-level and DOM-level tests would materially reduce migration risk.

## Overall Assessment

The codebase is generally legible: modules are small, state ownership is reasonably explicit, and the shell/feature split is understandable. The main problems are not basic organization mistakes; they are parity gaps and a few helper-runtime correctness issues that will matter more as `naf-html` becomes more central.

The highest-value next fixes are:

1. Wire per-file tree state persistence.
2. Restore drag-and-drop move/reorder behavior.
3. Harden `naf-html` (`computed`, `effect`, `model`) before expanding its usage.
