# Pain Point 1: Event Listener Boilerplate -- COMPLETE

## Problem

99 addEventListener calls and 91 removeEventListener calls across the frontend. Every listener required manual pairing -- add in onMount, remove in cleanup. This was error-prone, tedious, and dominated the onMount surface area.

## Solution

Added `listener()` helper to NAF that attaches a listener and returns a cleanup function, replacing the dead `$on()` function that was never used.

```js
export function listener(el, event, handler) {
  el?.addEventListener(event, handler);
  return () => el?.removeEventListener(event, handler);
}
```

## Results

- 18 files migrated across Phase 2
- ~90 lines of boilerplate cleanup code eliminated
- Zero risk of leaked listeners (cleanup is automatic)
- `listener()` accepts `EventTarget` (not just `Element`) so it works with `window`, `document`, etc.
- Remaining 15 addEventListener/removeEventListener calls are all legitimate non-migration cases:
  - 6 worker MessageChannel listeners
  - 6 conditional attach/detach patterns (position listeners)
  - 1 fire-and-forget handler (theme toggle)
  - 2 corresponding removeEventListener calls

## Files Changed

### NAF Runtime
- `frontend/src/shared/runtime/naf.js` -- replaced `$on()` with `listener()`
- `docs/naf-html-usage-guidelines.md` -- updated Runtime Surface, added Helper Guide entry
- `docs/frontend-maintainability-guidelines.md` -- added `listener()` to helpers list

### Migrated Files (Phase 2)
1. `frontend/src/features/detail/view/bookmark-detail.js` -- 14 listener pairs
2. `frontend/src/features/editing/add-bookmark-form.js` -- 7 listener pairs
3. `frontend/src/features/move/move-dialog.js` -- 8 listener pairs (2 in list rows + 6 at dialog level)
4. `frontend/src/features/import-merge/import-merge-dialog-interactions.js` -- 7 listener pairs
5. `frontend/src/features/detail/view/folder-detail.js` -- 6 listener pairs
6. `frontend/src/features/editing/add-folder-form.js` -- 4 listener pairs
7. `frontend/src/components/titlebar/titlebar.js` -- 5 listener pairs
8. `frontend/src/components/confirm-modal/confirm-modal.js` -- 5 listener pairs
9. `frontend/src/components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js` -- 4 listener pairs
10. `frontend/src/features/detail/view/bulk-selection-detail.js` -- 4 listener pairs
11. `frontend/src/layouts/app-shell/app-shell-layout.js` -- 4 listener pairs
12. `frontend/src/components/toolbar/toolbar-actions.js` -- 3 listener pairs
13. `frontend/src/features/tree/view/bookmark-tree-row.js` -- 3 listener pairs
14. `frontend/src/features/tree/view/bookmark-tree.js` -- 5 listener pairs
15. `frontend/src/features/tree/view/bookmark-search-result-row.js` -- 1 listener pair
16. `frontend/src/app/lifecycle.js` -- 2 listener pairs
17. `frontend/src/pages/empty-library/empty-library-page.js` -- 2 listener pairs
18. `frontend/src/features/shortcuts/global-shortcuts.js` -- 1 listener pair
