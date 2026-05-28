# Frontend Parity Checklist

Use this checklist to verify the vanilla JS frontend against the currently shipped app behavior.

Status keys:

- `[ ]` not yet verified
- `[x]` verified
- `[-]` intentionally changed

For each item, record:

- `Result:` pass/fail/changed
- `Notes:` observed behavior, regression details, or follow-up work

## Session Lifecycle

- `[ ]` App starts with no Wails bridge and still renders the shell without crashing.
  - Result:
  - Notes:
- `[ ]` App startup reads the CLI-provided file path via Wails and loads that file into session when present.
  - Result:
  - Notes:
- `[ ]` If no CLI file path is provided, startup restores `lastOpenedFile` from local persistence and attempts to load it.
  - Result:
  - Notes:
- `[ ]` If restoring `lastOpenedFile` fails, the stored path is cleared and an error toast is shown on non-silent failure.
  - Result:
  - Notes:
- `[ ]` `Open file` opens the picker, loads the selected file, refreshes tree/search state, and updates the current session path.
  - Result:
  - Notes:
- `[ ]` `Create file` creates a bookmark file through Wails, loads it immediately, and shows a success toast.
  - Result:
  - Notes:
- `[ ]` Loading a file resets selection, rebuilds the tree, rebuilds the flat search index, and initially expands all root folders before per-file restoration.
  - Result:
  - Notes:
- `[ ]` Tree mutations continue using the existing Wails/Go bindings contract rather than a new frontend-only data source.
  - Result:
  - Notes:

## Tree Rendering And Expansion

- `[ ]` Tree renders folders and bookmarks from backend data with stable IDs.
  - Result:
  - Notes:
- `[ ]` Folder rows show expanded/collapsed state, child count, and the correct icon variant.
  - Result:
  - Notes:
- `[ ]` Bookmark rows show favicon when available and fall back to the default bookmark icon when not.
  - Result:
  - Notes:
- `[ ]` Empty tree state shows the `No bookmarks or folders yet` message.
  - Result:
  - Notes:
- `[ ]` Folder expand/collapse works from the disclosure button.
  - Result:
  - Notes:
- `[ ]` Folder expand/collapse works from keyboard `Space` on a folder row.
  - Result:
  - Notes:
- `[ ]` `ArrowRight` on a collapsed folder expands it.
  - Result:
  - Notes:
- `[ ]` `ArrowRight` on an already expanded folder moves selection to its first child when present.
  - Result:
  - Notes:
- `[ ]` `ArrowLeft` on an expanded folder collapses it.
  - Result:
  - Notes:
- `[ ]` `ArrowLeft` on a collapsed row moves selection to the parent folder when one exists.
  - Result:
  - Notes:
- `[ ]` `expandAncestors(nodeId)` behavior is preserved so search activation and selection restoration reveal hidden descendants.
  - Result:
  - Notes:

## Selection Model

- `[ ]` Plain click selects a single node and sets it as both primary selection and range anchor.
  - Result:
  - Notes:
- `[ ]` Selection is cleared when attempting to select a missing node.
  - Result:
  - Notes:
- `[ ]` Multi-select is only allowed within the same sibling group and same node type.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Click` toggles membership in the current selection.
  - Result:
  - Notes:
- `[ ]` Toggling off the primary selected item promotes another selected item to primary when selection remains non-empty.
  - Result:
  - Notes:
- `[ ]` `Shift+Click` selects a range using visible node order, but only keeps items that satisfy the sibling/type constraint.
  - Result:
  - Notes:
- `[ ]` Invalid multi-select or range-select attempts show warning toasts instead of silently changing behavior.
  - Result:
  - Notes:
- `[ ]` `Shift+ArrowUp` and `Shift+ArrowDown` extend selection by sibling offset from the current anchor/pivot.
  - Result:
  - Notes:
- `[ ]` `Shift+Home` and `Shift+End` select to the first or last sibling in the current sibling group.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+A` selects all siblings that satisfy the current type/parent constraint.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Shift+A` collapses a multi-selection back to the primary item.
  - Result:
  - Notes:
- `[ ]` `Escape` collapses a multi-selection back to the primary item when no modal is intercepting it.
  - Result:
  - Notes:
- `[ ]` `treeStore.captureSelectionSnapshot()` and `restoreSelectionSnapshot()` preserve the best possible selection across undo/redo refreshes.
  - Result:
  - Notes:
- `[ ]` If restored selected nodes no longer exist, selection falls back to primary node, then surviving ancestors, then first surviving selected ID, then empty state.
  - Result:
  - Notes:

## Tree Navigation

- `[ ]` `ArrowDown` and `ArrowUp` move through visible tree rows when not searching.
  - Result:
  - Notes:
- `[ ]` `Home` selects the first visible tree item.
  - Result:
  - Notes:
- `[ ]` `End` selects the last visible tree item.
  - Result:
  - Notes:
- `[ ]` `PageUp` and `PageDown` jump selection by 10 visible rows.
  - Result:
  - Notes:
- `[ ]` `Enter` from the tree focus zone opens the selected item in the detail pane.
  - Result:
  - Notes:
- `[ ]` Tree container remains focusable as its own focus zone and can be re-focused from global commands.
  - Result:
  - Notes:

## Search

- `[ ]` Search input auto-focuses on app load.
  - Result:
  - Notes:
- `[ ]` Typing in search filters the flat bookmark index by case-insensitive title or URL match.
  - Result:
  - Notes:
- `[ ]` Search results view replaces the normal tree view while a non-empty query is active.
  - Result:
  - Notes:
- `[ ]` Search results show bookmark title-or-URL plus folder path.
  - Result:
  - Notes:
- `[ ]` Empty search result state shows `No results found`.
  - Result:
  - Notes:
- `[ ]` `ArrowDown` from the search input selects the first search result, expands its ancestors, and moves focus to the tree zone.
  - Result:
  - Notes:
- `[ ]` In search mode, tree-zone `ArrowUp/ArrowDown/Home/End` navigate search results rather than visible tree rows.
  - Result:
  - Notes:
- `[ ]` `Enter` in the search input opens the selected or first result in the detail pane.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Enter` in the search input opens the selected or first result directly in the browser.
  - Result:
  - Notes:
- `[ ]` `Enter` from the tree zone while search is active opens the selected or first result in detail.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Enter` from the tree zone while search is active opens the selected result directly.
  - Result:
  - Notes:
- `[ ]` `Escape` in the search input clears the query when non-empty, otherwise returns focus to the tree.
  - Result:
  - Notes:
- `[ ]` Search clear button clears the query without disturbing the rest of the session.
  - Result:
  - Notes:

## Detail Editing

- `[ ]` No selection state shows the `Select a bookmark or folder` empty detail panel.
  - Result:
  - Notes:
- `[ ]` Single bookmark selection opens bookmark detail.
  - Result:
  - Notes:
- `[ ]` Single folder selection opens folder detail.
  - Result:
  - Notes:
- `[ ]` Multi-selection opens the bulk-selection detail panel instead of single-item detail.
  - Result:
  - Notes:
- `[ ]` Bookmark detail supports edit/update through the existing backend mutation flow.
  - Result:
  - Notes:
- `[ ]` Bookmark detail can open the bookmark URL.
  - Result:
  - Notes:
- `[ ]` Bookmark detail can fetch a page title.
  - Result:
  - Notes:
- `[ ]` Bookmark detail can fetch a favicon.
  - Result:
  - Notes:
- `[ ]` Folder detail supports rename through the existing backend mutation flow.
  - Result:
  - Notes:
- `[ ]` Folder detail can add a child bookmark inline.
  - Result:
  - Notes:
- `[ ]` Folder detail can add a child folder inline.
  - Result:
  - Notes:
- `[ ]` Root-level add bookmark form can be opened from the left-pane toolbar and keyboard shortcut flow.
  - Result:
  - Notes:
- `[ ]` Root-level add folder form can be opened from the left-pane toolbar and keyboard shortcut flow.
  - Result:
  - Notes:
- `[ ]` Keyboard shortcut `A` opens add-bookmark in the selected folder, selected item parent folder, or root depending on current selection context.
  - Result:
  - Notes:
- `[ ]` Keyboard shortcut `Shift+A` opens add-folder in the selected folder, selected item parent folder, or root depending on current selection context.
  - Result:
  - Notes:
- `[ ]` Keyboard shortcut `E` focuses edit mode for the current selection.
  - Result:
  - Notes:
- `[ ]` Keyboard shortcut `F2` triggers rename-focused edit behavior.
  - Result:
  - Notes:

## Delete, Move, And Batch Operations

- `[ ]` Single delete opens a confirm modal with bookmark-specific or folder-specific wording.
  - Result:
  - Notes:
- `[ ]` Folder delete confirm warns that contents will also be deleted.
  - Result:
  - Notes:
- `[ ]` Bulk delete opens a confirm modal using folder/bookmark plural wording based on selection type.
  - Result:
  - Notes:
- `[ ]` Confirmed single delete clears selection, refreshes the tree, and shows a success toast.
  - Result:
  - Notes:
- `[ ]` Confirmed bulk delete clears selection, refreshes the tree, and shows a success toast with item count.
  - Result:
  - Notes:
- `[ ]` Single move opens the move dialog with the selected node label and type.
  - Result:
  - Notes:
- `[ ]` Bulk move opens the move dialog using the selected count label and correct bookmark/folder type.
  - Result:
  - Notes:
- `[ ]` Move dialog excludes destination folders that are inside the moved folder branch.
  - Result:
  - Notes:
- `[ ]` Bookmark bulk actions support `Fetch favicon(s)` and `Refresh title(s)` from the current selection.
  - Result:
  - Notes:
- `[ ]` Bulk favicon/title refresh is disabled for folder selections.
  - Result:
  - Notes:
- `[ ]` Batch actions refresh the tree and show success/error toasts.
  - Result:
  - Notes:

## Drag And Drop

- `[ ]` Single-node drag-and-drop is enabled only when multi-select is not active.
  - Result:
  - Notes:
- `[ ]` Dropping on the middle of a folder moves the dragged node inside that folder at append position.
  - Result:
  - Notes:
- `[ ]` Dropping near the top or bottom of a folder chooses before/after placement.
  - Result:
  - Notes:
- `[ ]` Dropping on a bookmark chooses before/after placement based on pointer position.
  - Result:
  - Notes:
- `[ ]` Successful drag-and-drop move calls the existing backend move API and refreshes tree state.
  - Result:
  - Notes:
- `[ ]` Dragging a node onto itself is ignored.
  - Result:
  - Notes:
- `[ ]` Root-level reorder remains unsupported and shows the existing error toast rather than silently behaving differently.
  - Result:
  - Notes:

## Dialogs And Overlays

- `[ ]` Toasts appear for success, info, warning, and error events and auto-dismiss after duration.
  - Result:
  - Notes:
- `[ ]` Confirm modal opens from store state, runs async confirm callbacks, and always closes afterward.
  - Result:
  - Notes:
- `[ ]` Import/merge dialog opens from `Ctrl/Cmd+Shift+I`.
  - Result:
  - Notes:
- `[ ]` Import/merge preview loads selected file data and keeps dialog state in sync with loading/error/apply status.
  - Result:
  - Notes:
- `[ ]` Import/merge preview closes itself and shows `No new changes found` when there are no additions.
  - Result:
  - Notes:
- `[ ]` Import/merge apply refreshes the tree and shows a success toast summarizing folders/bookmarks added.
  - Result:
  - Notes:
- `[ ]` Import/merge dialog cannot be casually closed while apply is in progress unless forced by internal completion logic.
  - Result:
  - Notes:
- `[ ]` Keyboard shortcuts dialog opens from `F1` or `?` and closes from `Escape` or its close button.
  - Result:
  - Notes:
- `[ ]` Modal/dialog surfaces use focus trapping and mark themselves as the `dialog` focus zone.
  - Result:
  - Notes:
- `[ ]` Clicking the backdrop closes dialogs only where the current app allows it.
  - Result:
  - Notes:

## Keyboard Commands

- `[ ]` `Ctrl/Cmd+O` opens file picker.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+N` creates a new file.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+F` focuses and selects the search input.
  - Result:
  - Notes:
- `[ ]` `/` focuses search when not typing in an editable control.
  - Result:
  - Notes:
- `[ ]` `F6` cycles focus between search, tree, and detail zones.
  - Result:
  - Notes:
- `[ ]` `O` opens the selected bookmark.
  - Result:
  - Notes:
- `[ ]` `M` opens the move workflow for the current selection.
  - Result:
  - Notes:
- `[ ]` `Delete` and `Backspace` trigger the delete workflow when focus is not in an editable control.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Shift+F` refreshes favicons for selected bookmarks.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Shift+T` refreshes titles for selected bookmarks.
  - Result:
  - Notes:
- `[ ]` Global shortcuts do not fire while the user is typing in inputs, textareas, selects, or contenteditable regions.
  - Result:
  - Notes:

## History

- `[ ]` `Ctrl/Cmd+Z` runs undo when history state reports `canUndo`.
  - Result:
  - Notes:
- `[ ]` `Ctrl/Cmd+Y` and `Ctrl/Cmd+Shift+Z` run redo when history state reports `canRedo`.
  - Result:
  - Notes:
- `[ ]` Undo/redo refresh the tree after mutation.
  - Result:
  - Notes:
- `[ ]` Undo/redo preserve the best available selection using the selection snapshot restoration logic.
  - Result:
  - Notes:
- `[ ]` Undo/redo show success toasts using backend-provided action labels when available.
  - Result:
  - Notes:

## Persistence

- `[ ]` Left-pane width is restored from persisted UI state on startup.
  - Result:
  - Notes:
- `[ ]` Left-pane width updates are persisted after resizing.
  - Result:
  - Notes:
- `[ ]` Left-pane resizing clamps between minimum width and available container width.
  - Result:
  - Notes:
- `[ ]` Per-file tree state persists expanded folder IDs and primary selected node ID.
  - Result:
  - Notes:
- `[ ]` Restoring per-file tree state ignores missing folder IDs and missing selected IDs safely.
  - Result:
  - Notes:
- `[ ]` Local persisted UI state survives malformed or missing storage data by falling back to defaults.
  - Result:
  - Notes:
- `[ ]` Window size is restored on startup when Wails runtime is available.
  - Result:
  - Notes:
- `[ ]` Window size persistence only records normal window size, not maximized/minimized states.
  - Result:
  - Notes:
- `[ ]` Window size persistence is debounced on resize and flushed on unload.
  - Result:
  - Notes:
- `[ ]` Per-file tree state storage remains capped to the existing max file-state count.
  - Result:
  - Notes:

## Shell And Window Behavior

- `[ ]` Frameless titlebar still supports Wails drag regions and no-drag button regions.
  - Result:
  - Notes:
- `[ ]` Titlebar double-click toggles maximize state.
  - Result:
  - Notes:
- `[ ]` Minimize, maximize/restore, and close buttons keep the current Wails runtime behavior.
  - Result:
  - Notes:
- `[ ]` Maximize state is re-synced on window focus.
  - Result:
  - Notes:
- `[ ]` Loading spinner and error text in the titlebar reflect tree loading/error state.
  - Result:
  - Notes:
- `[ ]` The shell still exposes stable containers for search, tree, detail, toasts, confirm modal, move dialog, import/merge dialog, and keyboard help.
  - Result:
  - Notes:

## Cutover Acceptance

- `[ ]` New frontend reaches parity for all must-keep behaviors before old Svelte/Vite/Tailwind code is removed.
  - Result:
  - Notes:
- `[ ]` `frontend/dist` is still produced by the frontend build flow used by Wails.
  - Result:
  - Notes:
- `[ ]` Any intentional behavioral changes are explicitly recorded here before migration completion.
  - Result:
  - Notes:
