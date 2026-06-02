# Pain Point #3: Merge collectShell / mount Two-Phase Pattern

## Problem

Every module exports both `collectXxxShell(root)` and `mountXxx(shell)`. The collect function is a trivial wrapper around 1-5 `requireElement()` calls, always immediately consumed by the corresponding mount function. Callers write:

```js
const result = mountXxx(collectXxxShell(root));
```

This adds ceremony: two exported functions per module, two imports per caller, a shell typedef that documents an implementation detail, and a mechanical intermediate step that serves no purpose.

The two-phase pattern was useful during the requireRef migration (painpoint3) for separating validation from behavior, but now that validation is a one-liner (`requireElement`), the separation is mechanical overhead.

## Current Scope

### Modules with collect/mount pairs (10 modules)

| Module | collect function | mount function | Shell elements |
|--------|-----------------|----------------|----------------|
| titlebar.js | collectTitlebarShell | mountTitlebar | { titlebar } |
| search-bar.js | collectSearchBarShell | mountSearchBar | { input } |
| bookmark-tree.js | collectBookmarkTreeShell | mountBookmarkTree | { root, treeList, treePaneMeta } |
| detail-panel.js | collectDetailPanelShell | mountDetailPanel | { content, meta } |
| move-dialog.js | collectMoveDialogShell | mountMoveDialog | { container } |
| import-merge-dialog.js | collectImportMergeDialogShell | mountImportMergeDialog | { container } |
| toast-container.js | collectToastContainerShell | mountToastContainer | { container } |
| confirm-modal.js | collectConfirmModalShell | mountConfirmModal | { container } |
| keyboard-shortcuts-dialog.js | collectKeyboardShortcutsDialogShell | mountKeyboardShortcutsDialog | { container } |
| app-shell-layout.js | collectLayoutShell | mountLayout | { root, mainContent, paneResizer } |

### Caller files (2 files)

- `create-app.js` -- imports both collect and mount for 8 modules
- `library-page.js` -- imports both collect and mount for 3 feature modules

### Special case: page-frame.js

Exports only `collectPageHost(root)` with no corresponding mount. Used once in library-page.js to find `#page-host`. Will be inlined into the mount call.

## Proposed Change

Merge each collect function into its mount function. The mount function takes `root` directly:

**Before:**
```js
export function collectXxxShell(root) {
  return { el: requireElement(root, "#selector", "desc") };
}
export function mountXxx(shell) { ... shell.el ... }
// Caller: mountXxx(collectXxxShell(root))
```

**After:**
```js
export function mountXxx(root) {
  const el = requireElement(root, "#selector", "desc");
  ...
}
// Caller: mountXxx(root)
```

### What changes

1. **10 module files** -- merge collect into mount, remove collect export, remove shell typedef
2. **create-app.js** -- change `mountX(collectXShell(root))` to `mountX(root)`, remove collect imports
3. **library-page.js** -- change `mountX(collectXShell(shell.root))` to `mountX(shell.root)`, remove collect imports
4. **page-frame.js** -- inline `collectPageHost` into `mountLibraryPage`
5. **Confirm-modal.js** -- while touching it, also update the manual instanceof check to use `requireElement` (toast-container.js already has the same pattern; update both)
6. **Update docs** if the two-phase pattern is documented anywhere

### What does NOT change

- `AppShell` typedef in create-app.js -- this is the app-level shell that pages use to access DOM elements. It is genuinely useful because multiple consumers share it.
- The `template()` / `mount()` pattern for bounded components with `data-ref` -- that is a different pattern (onMount receives ctx.refs from NAF's collectRefs).
- `list()` setup callbacks -- those are row-level, not shell-level.

## Task Breakdown

### Task 1: Merge collect/mount in each module (10 files)

For each module:
1. Move `requireElement` calls from collect function into mount function body
2. Remove collect function export
3. Remove shell typedef (e.g., `@typedef {object} XxxShell`)
4. Change mount signature from `mountXxx(shell)` to `mountXxx(root)`
5. Replace `shell.xxx` references with local variable names
6. Verify typecheck + build

Order (simplest first):
1a. toast-container.js (1 element)
1b. confirm-modal.js (1 element, also fix instanceof -> requireElement)
1c. move-dialog.js (1 element)
1d. import-merge-dialog.js (1 element)
1e. keyboard-shortcuts-dialog.js (1 element)
1f. titlebar.js (1 element)
1g. search-bar.js (1 element)
1h. app-shell-layout.js (3 elements)
1i. bookmark-tree.js (3 elements)
1j. detail-panel.js (3 elements)

### Task 2: Update callers (2 files)

2a. create-app.js:
- Remove 8 collect imports
- Change each `mountX(collectXShell(root))` to `mountX(root)`

2b. library-page.js:
- Remove 3 collect imports
- Change each `mountX(collectXShell(shell.root))` to `mountX(shell.root)`
- Inline `collectPageHost` -- replace `const pageHost = collectPageHost(shell.root)` with `const pageHost = requireElement(shell.root, "#page-host", "page-host")` (add requireElement import)
- Remove collectPageHost import

### Task 3: Clean up page-frame.js

3a. Remove `collectPageHost` export (no longer used externally)
3b. Verify no other files import it

### Task 4: Update documentation

4a. `docs/naf-html-usage-guidelines.md` -- update `requireElement()` section (line 455):
   - Change "Use in `collectShell` functions" to "Use in mount functions"
   - Update example to show inline usage inside a mount function
4b. `docs/frontend-maintainability-guidelines.md` -- no mention of two-phase pattern, no change needed
4c. `docs/agent-project-context.md` -- no mention, no change needed
4d. Update `analysis.md` to mark painpoint #3 as resolved (add RESOLVED note similar to painpoint3.md pattern)

### Task 5: Verify

```bash
cd frontend && npm run typecheck && npm run build
```

## Risks and Mitigations

1. **Root reuse**: Some collect functions just return `{ root: root }` (e.g., bookmark-tree.js). After merging, the root parameter IS the root -- no issue, just rename the variable internally.

2. **Shell typedef removal**: The typedefs document the shell shape. After merging, the mount function body documents what elements are needed. This is acceptable because the shell is an implementation detail -- callers shouldn't need to know it.

3. **Test coverage**: If there are tests that import collect functions directly, they need updating. Check for test files.

4. **Behavioral equivalence**: This is a mechanical refactor -- no behavior changes. Each task should be verified independently with typecheck + build.

## Expected Outcome

- ~30 lines removed per module (collect function + typedef + JSDoc)
- ~10 lines removed per caller (import lines + function call wrapping)
- Total: ~350-400 lines removed across the codebase
- Simpler module API: one exported function per module instead of two
- Clearer convention: `mountXxx(root)` is the single entry point
