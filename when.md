# when() Usage Analysis

## Current State

`when()` is now used in 5 files after migrating dialog/modal patterns and the toast container.

## Implemented Migrations

### 1. Dialog/Modal Open/Closed State (High Value) - DONE

**Files:**
- `components/confirm-modal/confirm-modal.js`
- `components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.js`
- `features/move/move-dialog.js`
- `features/import-merge/import-merge-dialog.js`

**Before:**
```js
let cleanupRendered;

const stop = effect(() => {
  cleanupRendered?.();
  cleanupRendered = undefined;
  shell.container.replaceChildren();

  if (!isOpen) {
    return;
  }

  const component = createDialog();
  mount(component, shell.container);

  cleanupRendered = () => {
    component.unmount?.();
    shell.container.replaceChildren();
  };
});
```

**After:**
```js
const renderShell = /** @type {TemplateTag} */ (template);

const component = renderShell`
  ${when(
    () => getIsOpen(),
    () => createDialog(),
    () => createEmptyComponent(),
  )}
`;

mount(component, shell.container);
```

**Benefits:**
- Eliminates manual cleanupRendered tracking pattern
- Handles unmount/mount lifecycle automatically
- Cleaner separation of open/closed states
- ~20 lines removed per file

### 2. Toast Container Visibility (Medium Value) - DONE

**File:** `components/toast/toast-container.js`

**Before:**
```js
const stopVisibility = effect(() => {
  stack.hidden = uiState.selectors.getToasts().length === 0;
});
```

**After:**
```js
when(
  () => uiState.selectors.getToasts().length > 0,
  () => createToastStack(),
  () => createEmptyComponent(),
)
```

**Benefits:**
- Actual DOM removal vs hiding (better for accessibility)
- Proper lifecycle management for complex internal state
- Cleaner than .hidden = toggle

## Summary

| Pattern | Files | Value | Status |
|---------|-------|-------|--------|
| Dialog/Modal open/closed | 4 | High | DONE |
| Toast container | 1 | Medium | DONE |
| Titlebar spinner | 1 | Low | Skipped |
| Add form panels | 2 | Medium | Skipped |
| Editing vs viewing | 2 | Low | Skipped |
| Empty vs data state | 2 | Low | Skipped |

## Conclusion

`when()` is now used in 5 files for dialog/modal patterns and the toast container. The migrations eliminated manual cleanup tracking patterns and provided proper lifecycle management.

files are the best candidates for when() adoption.
