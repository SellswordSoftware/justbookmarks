# Pain Point 4: State Module Pattern Inconsistency

## Problem

The architecture docs say "do not reintroduce broad selectors/actions/signals wrapper namespaces" but every feature state module uses exactly this pattern. Meanwhile app-state.js uses a flatter domain-group pattern, and save-state.js exports a bare signal.

**Three patterns currently in use:**

1. **signals/actions/computed/selectors** -- treeState, searchState, uiState, moveDialogState, importMergeState
2. **Flat domain-group** -- appState (signals at top level, actions grouped under domain keys)
3. **Bare export** -- saving (just `export const saving = signal(false)`)

**Why the signals/actions/computed/selectors pattern works:**
- Clear read vs write boundaries (selectors = read, actions = write)
- Prevents accidental signal mutation from outside the module
- Internal signals stay private (module-scoped consts)
- Consistent API surface across all feature modules

**Why the flat domain-group pattern is problematic:**
- Exposes raw signals at top level -- callers can mutate `appState.currentFilePath("new")` directly
- No clear read/write boundary -- actions mixed with signals
- Domain sub-keys (`session`, `window`, etc.) are ad-hoc and undocumented
- Hard to reason about which properties are signals, actions, or plain functions

## Decision

Formally adopt the **signals/actions/computed/selectors** pattern as the canonical state module shape. Update the architecture docs to document it. Migrate app-state.js to match. Keep save-state.js as-is (it is a single signal that is re-exported by appState).

## Canonical State Module Shape

```js
// @ts-check
import { signal, computed } from "../runtime/naf.js";

// Private signals (module-scoped, not exported directly)
const someValue = signal(initial);
const derived = computed(() => someValue() + "-derived");

// Private helper functions
function doSomething() { ... }

// Public export
export const someState = {
  signals: {
    someValue,
  },
  computed: {
    derived,
  },
  actions: {
    doSomething,
    setSomeValue(next) { return someValue(next); },
  },
  selectors: {
    getSomeValue() { return someValue(); },
    getDerived() { return derived(); },
  },
};
```

**Rules:**
- Signals are private module-scoped consts, exposed only via the `signals` namespace
- Actions mutate state. Each action has a clear name and JSDoc types.
- Selectors read state. They call signals/computed to get values.
- Computed values are exposed via the `computed` namespace for reactive reads.
- Internal helpers stay as module-scoped functions (not exported).

## Migration Plan

### Phase 0: Update documentation

**Files:**
- `docs/frontend-architecture.md`
- `docs/frontend-maintainability-guidelines.md`
- `docs/agent-project-context.md`

**Changes:**
- Replace "direct signal/domain-group shared state modules" with "signals/actions/computed/selectors state modules"
- Document the canonical state module shape (see above)
- Remove "Avoid broad wrapper layers like selectors/actions/signals when a simpler surface is clear"
- Add guidance: "Use the signals/actions/computed/selectors pattern for all state modules"
- Update the shared state section to describe the canonical shape
- Update the review checklist item #8 to reference the canonical pattern

**Verification:** No code changes -- just docs.

### Phase 1: Migrate app-state.js to canonical pattern

**File:** `frontend/src/shared/state/app-state.js`

**Current shape:**
```js
export const appState = {
  currentFilePath,           // signal at top level
  hasTriedLoad,              // signal at top level
  persistenceReady,          // signal at top level
  isMaximised,               // signal at top level
  keyboardShortcutsOpen,     // signal at top level
  saving,                    // re-exported signal
  persistedState,            // signal at top level
  hasWailsRuntime,           // plain function
  session: { ... },          // domain group with actions
  window: { ... },           // domain group with signals + actions
  keyboardShortcuts: { ... }, // domain group with actions
  importMerge: { ... },      // domain group with forwarded actions
};
```

**Target shape:**
```js
export const appState = {
  signals: {
    currentFilePath,
    hasTriedLoad,
    persistenceReady,
    isMaximised,
    keyboardShortcutsOpen,
    saving,
    persistedState,
  },
  computed: {},
  actions: {
    // Session actions
    setCurrentFilePath(path) { ... },
    setHasTriedLoad(value) { ... },
    setPersistenceReady(value) { ... },
    getStartupFilePath() { ... },
    openFilePicker() { ... },
    createBookmarkFile() { ... },
    restoreWindowSize() { ... },
    rememberLoadedFile(path) { ... },
    reloadPersistedState() { ... },
    // Window actions
    setTheme(value) { ... },
    syncWindowState() { ... },
    persistCurrentSize() { ... },
    persistWindowState(windowState) { ... },
    // Keyboard shortcuts actions
    setKeyboardShortcutsOpen(value) { ... },
    openKeyboardShortcuts() { ... },
    closeKeyboardShortcuts() { ... },
    // Runtime
    hasWailsRuntime() { ... },
  },
  selectors: {
    getCurrentFilePath() { return currentFilePath(); },
    getHasTriedLoad() { return hasTriedLoad(); },
    getPersistenceReady() { return persistenceReady(); },
    isMaximised() { return isMaximised(); },
    isKeyboardShortcutsOpen() { return keyboardShortcutsOpen(); },
    isSaving() { return saving(); },
    getPersistedState() { return persistedState(); },
    getTheme() { return theme(); },
    hasWailsRuntime() { return hasWailsRuntime(); },
  },
};
```

**Note:** The `importMerge` sub-key currently just forwards `importMergeState.actions.openImportMerge`. This should be removed from appState entirely -- callers should use `importMergeState.actions.openImportMerge()` directly.

### Phase 2: Update all appState call sites

**~52 call sites across these files:**

**Signal reads at top level:**
- `appState.currentFilePath()` -> `appState.selectors.getCurrentFilePath()`
  Files: global-shortcuts.js, global-shortcuts-history.js, add-bookmark-form.js, add-folder-form.js, toolbar-actions.js, import-merge-state.js, page-host.js, library-page.js (2x)
- `appState.persistedState()` -> `appState.selectors.getPersistedState()`
  Files: app-shell-layout.js (3x)
- `appState.keyboardShortcutsOpen()` -> `appState.selectors.isKeyboardShortcutsOpen()`
  Files: global-shortcuts.js
- `appState.isMaximised()` -> `appState.selectors.isMaximised()`
  Files: titlebar.js
- `appState.hasWailsRuntime()` -> `appState.selectors.hasWailsRuntime()`
  Files: titlebar.js (4x)

**Domain group actions:**
- `appState.session.X()` -> `appState.actions.X()`
  Files: session.js (10x), lifecycle.js, page-host.js
- `appState.window.X()` -> `appState.actions.X()` or `appState.selectors.getX()`
  Files: titlebar.js (6x), lifecycle.js (3x), session.js (3x)
- `appState.keyboardShortcuts.X()` -> `appState.actions.X()`
  Files: global-shortcuts.js (2x), keyboard-shortcuts-dialog.js (2x)
- `appState.importMerge.openImportMerge()` -> `importMergeState.actions.openImportMerge()`
  Files: page-host.js (1x)

**Strategy:** Update files in dependency order to catch errors early:
1. app-state.js itself (Phase 1)
2. app/session.js (most call sites)
3. app/lifecycle.js
4. app/page-host.js
5. components/titlebar/titlebar.js
6. components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js
7. features/shortcuts/global-shortcuts.js
8. features/shortcuts/global-shortcuts-history.js
9. features/editing/add-bookmark-form.js
10. features/editing/add-folder-form.js
11. components/toolbar/toolbar-actions.js
12. features/import-merge/import-merge-state.js
13. layouts/app-shell/app-shell-layout.js
14. pages/library/library-page.js
15. pages/empty-library/empty-library-page.js

**Verification after each file:** `npm run typecheck`

### Phase 3: Verify and clean up

**Tasks:**
1. Run `npm run typecheck` -- must pass
2. Run `npm run build` -- must pass
3. Check that no stale imports or dead code remain
4. Verify `saving` export in save-state.js is still correct (it is re-exported by appState.signals.saving)

## Task Checklist

- [x ] **Phase 0:** Update docs (frontend-architecture.md, frontend-maintainability-guidelines.md, agent-project-context.md)
- [x ] **Phase 1:** Rewrite app-state.js to canonical pattern
- [ ] **Phase 2.1:** Update app/session.js call sites
- [ ] **Phase 2.2:** Update app/lifecycle.js call sites
- [ ] **Phase 2.3:** Update app/page-host.js call sites
- [ ] **Phase 2.4:** Update components/titlebar/titlebar.js call sites
- [ ] **Phase 2.5:** Update components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js call sites
- [ ] **Phase 2.6:** Update features/shortcuts/global-shortcuts.js call sites
- [ ] **Phase 2.7:** Update features/shortcuts/global-shortcuts-history.js call sites
- [ ] **Phase 2.8:** Update features/editing/add-bookmark-form.js call sites
- [ ] **Phase 2.9:** Update features/editing/add-folder-form.js call sites
- [ ] **Phase 2.10:** Update components/toolbar/toolbar-actions.js call sites
- [ ] **Phase 2.11:** Update features/import-merge/import-merge-state.js call sites
- [ ] **Phase 2.12:** Update layouts/app-shell/app-shell-layout.js call sites
- [ ] **Phase 2.13:** Update pages/library/library-page.js call sites
- [ ] **Phase 2.14:** Update pages/empty-library/empty-library-page.js call sites
- [ ] **Phase 3.1:** Run typecheck -- must pass
- [ ] **Phase 3.2:** Run build -- must pass
- [ ] **Phase 3.3:** Final review for dead code / stale imports

## Notes

- save-state.js does NOT need migration. It exports a single signal (`saving`) that is imported and re-exported by app-state.js. This is a valid pattern for simple shared signals.
- The feature state modules (treeState, searchState, uiState, moveDialogState, importMergeState) already use the canonical pattern and do NOT need changes.
- The `importMerge` forwarding in appState is unnecessary indirection -- remove it and have callers use importMergeState directly.
- `hasWailsRuntime` is a plain function, not a signal. It will be exposed as both an action (for the check) and a selector (for reading). This is slightly unconventional but matches the existing usage pattern where it is called as `appState.hasWailsRuntime()`.
