# Undo/Redo Implementation Plan

## Scope

Implement session-scoped undo/redo for:

- move
- delete
- rename
- bookmark edits
- current bulk actions
- import/merge apply

Explicit scope decisions:

- history is session-only
- history is cleared when a different file is loaded
- history does not survive app restart
- undo/redo must write the current file back to disk, same as normal edits
- all edits from the detail panel count as undoable edits
- import/merge is a single undoable history entry

Out of scope for this phase:

- persistent history across launches
- per-keystroke undo while typing before pressing `Save`
- branching history UI
- timeline viewer
- undo for file open/create

## Current Constraints

The current app flow is:

1. frontend calls a Wails handler method
2. handler mutates `h.tree`
3. handler saves immediately
4. frontend refreshes the tree

That means undo/redo must live in the backend, not the Svelte store. If history only existed in the frontend, it would drift from the on-disk file after every autosave.

## Recommended Architecture

Add a backend history manager that executes explicit undoable commands.

Core model:

- every undoable action is a `Command`
- a command can `Apply` and `Undo`
- successful `Apply` pushes onto the undo stack
- `Undo` pops from undo, runs inverse, saves, then pushes onto redo
- `Redo` pops from redo, reapplies, saves, then pushes onto undo
- any new successful command clears the redo stack

This keeps:

- backend tree
- saved file
- frontend state

in sync.

## Domain Design

### New file

- `internal/bookmarks/history.go`

### New types

```go
type Command interface {
	Label() string
	Apply(tree []Node) ([]Node, error)
	Undo(tree []Node) ([]Node, error)
}

type HistoryState struct {
	CanUndo   bool   `json:"canUndo"`
	CanRedo   bool   `json:"canRedo"`
	UndoLabel string `json:"undoLabel"`
	RedoLabel string `json:"redoLabel"`
}
```

The `Command` interface should stay narrow. The handler owns stack behavior and file saving. Commands should only be responsible for deterministic tree transforms.

### Recommended command implementations

- `UpdateBookmarkCommand`
- `RenameFolderCommand`
- `DeleteNodeCommand`
- `DeleteNodesCommand`
- `MoveNodeCommand`
- `MoveNodesCommand`
- `BulkRefreshTitlesCommand`
- `BulkRefreshFaviconsCommand`
- `ApplyMergeCommand`

If implementation pressure is high, single-node and multi-node variants can share internal helpers, but they should still produce one logical history entry per user action.

## Snapshot Strategy

Undo will only be reliable if each command captures enough pre-change state.

### Bookmark edit command

Capture:

- bookmark id
- full `before` bookmark snapshot
- full `after` bookmark snapshot

Rationale:

- avoids patch inversion edge cases
- supports title, URL, meta, icon, icon URI in one mechanism

### Folder rename command

Capture:

- folder id
- old name
- new name

### Delete commands

Capture per deleted node:

- full node snapshot
- parent id
- original sibling index

Rationale:

- undo must restore deleted folders with all descendants intact
- restore must preserve original ordering

### Move commands

Capture per moved node:

- node id
- source parent id
- source index
- destination parent id
- destination index

For multi-move, capture the original sibling order and the final inserted order explicitly. Do not try to infer it later from current tree state.

### Bulk refresh commands

Capture only the nodes that actually changed:

- node id
- full `before` bookmark snapshot
- full `after` bookmark snapshot

If a bulk action changes nothing, do not push a history entry.

### Merge command

Treat import/merge apply as one command.

Capture:

- import file path for label only
- `beforeTree []Node`
- `afterTree []Node`
- merge result counts

Recommendation:

- implement merge undo as tree snapshot replacement, not as hand-built inverse folder/bookmark operations

Reason:

- merge is additive but may create many folders and bookmarks in one apply
- snapshot replace is much safer and simpler

## Tree Copying

Because the tree uses nested pointers, command snapshots must deep copy the affected data.

Add helpers:

- `CloneTree(nodes []Node) []Node`
- `CloneNode(node Node) Node`
- `CloneBookmark(b Bookmark) Bookmark`
- `CloneFolder(f Folder) Folder`

These should live in `internal/bookmarks/` and be covered by tests.

Without deep cloning, undo data will be corrupted by later edits.

## Handler Changes

Primary file:

- `internal/wailsapi/handler.go`

Extend `Handler`:

```go
type Handler struct {
	filePath string
	tree     []bookmarks.Node
	undoStack []bookmarks.Command
	redoStack []bookmarks.Command
}
```

Add helpers:

```go
func (h *Handler) executeCommand(cmd bookmarks.Command) error
func (h *Handler) undo() error
func (h *Handler) redo() error
func (h *Handler) clearHistory()
func (h *Handler) historyState() bookmarks.HistoryState
```

Execution rules:

1. apply command to current tree
2. save file
3. update `h.tree`
4. push command onto undo stack
5. clear redo stack

Undo rules:

1. pop command from undo stack
2. run `Undo`
3. save file
4. update `h.tree`
5. push command onto redo stack

Redo rules:

1. pop command from redo stack
2. run `Apply`
3. save file
4. update `h.tree`
5. push command onto undo stack

Important detail:

- if save fails, do not mutate stacks
- command execution should be effectively transactional from the handler’s point of view

Recommended implementation:

- compute `nextTree`
- save `nextTree`
- only then assign `h.tree = nextTree` and mutate stacks

That avoids a mismatch between memory and disk on save failure.

## Wails API Changes

Add endpoints:

```go
func (h *Handler) GetHistoryState() bookmarks.HistoryState
func (h *Handler) Undo() (bookmarks.HistoryState, error)
func (h *Handler) Redo() (bookmarks.HistoryState, error)
```

Optional convenience endpoints if needed later:

- `CanUndo() bool`
- `CanRedo() bool`

`GetHistoryState()` is enough for v1.

Also update `LoadFile()` to clear history whenever a file is loaded successfully.

## Refactor Existing Mutations

These existing handler methods should be converted to commands:

- `UpdateBookmark`
- `UpdateFolderName`
- `DeleteNode`
- `DeleteNodes`
- `MoveNode`
- `MoveNodes`
- `FetchFaviconsForNodes`
- `RefreshTitlesForNodes`
- `ApplyImportMerge`

Recommended implementation order:

1. `UpdateFolderName`
2. `UpdateBookmark`
3. `DeleteNode`
4. `DeleteNodes`
5. `MoveNode`
6. `MoveNodes`
7. `RefreshTitlesForNodes`
8. `FetchFaviconsForNodes`
9. `ApplyImportMerge`

This order starts with simple before/after edits, then moves into structural mutations.

## Frontend Plan

Files likely involved:

- `frontend/src/lib/api.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/App.svelte`
- existing detail/move/bulk components

### New frontend API bindings

Add:

- `GetHistoryState()`
- `Undo()`
- `Redo()`

Add TS type mirroring `HistoryState`.

### UI controls

Do not add Undo/Redo buttons.

Undo/redo entry point for this feature is keyboard-only.

### Keyboard shortcuts

Support:

- `Ctrl+Z`
- `Ctrl+Y`
- `Ctrl+Shift+Z`

Guardrails:

- do not hijack shortcuts while focus is inside an editable input or textarea unless the edit has already been committed
- history shortcut should apply to app actions, not in-field text editing
- `Ctrl+Y` and `Ctrl+Shift+Z` should both trigger redo

### Refresh behavior

After each undo/redo:

- refresh tree
- refresh flat index
- refresh history state

### Selection restoration

Current selection is frontend-owned, so undo/redo must restore selection intentionally.

Recommended rule set:

1. if the previously selected node still exists, keep it selected
2. if it no longer exists, try previous parent
3. otherwise clear selection

For deletes undone back into existence:

- if the primary selected node was part of the deleted set, restore selection to that node id after refresh

Selection restoration is not just polish. Without it, undoing deletes and moves will feel broken.

## History Labels

Each command should expose a short user-facing label for diagnostics and toasts.

Examples:

- `Rename Folder`
- `Edit Bookmark`
- `Delete Bookmark`
- `Delete 4 Bookmarks`
- `Move Folder`
- `Move 3 Bookmarks`
- `Refresh Titles`
- `Refresh Favicons`
- `Import Merge`

Keep labels stable and short.

## Save Semantics

Undo and redo are first-class mutations, so they should auto-save exactly like other actions.

This means:

- a successful undo changes the file on disk immediately
- a successful redo changes the file on disk immediately

No separate dirty state should be introduced for this feature.

## Testing Plan

### New backend tests

- `internal/bookmarks/history_test.go`
- extend `internal/wailsapi/handler_test.go`

### Domain tests

1. bookmark edit command restores exact prior values on undo
2. folder rename command restores original name on undo
3. delete command restores node and exact sibling index
4. bulk delete restores all nodes in original order
5. move command restores source parent and index
6. multi-move restores original order and location
7. bulk title refresh only records changed nodes
8. bulk favicon refresh only records changed nodes
9. merge command restores full pre-merge tree
10. clone helpers deep copy nested folders and bookmarks

### Handler tests

1. successful command pushes undo and clears redo
2. undo moves command from undo stack to redo stack
3. redo moves command back to undo stack
4. new command after undo clears redo stack
5. failed save does not mutate history stacks
6. loading a new file clears history
7. `GetHistoryState()` reports labels correctly
8. undo with empty stack returns a stable error
9. redo with empty stack returns a stable error

### Frontend checks

1. keyboard shortcuts call the right API
2. both `Ctrl+Y` and `Ctrl+Shift+Z` trigger redo
3. undo/redo does not trigger while typing in text fields
4. selection restoration behaves correctly after delete, move, and merge undo

## Edge Cases

### Root-level moves and deletes

History payloads must handle empty parent ids correctly.

### Nested folder deletes

Undo must restore the entire subtree, not reconstruct from descendants.

### Repeated edits to the same bookmark

Each explicit save creates a separate history entry. Do not coalesce in v1.

### Bulk actions with partial success

Recommended rule:

- if zero nodes change, return a user-visible error or no-op result and do not push history
- if some nodes change, create one history entry containing only changed nodes

### Import merge undo

Undoing merge should restore:

- folders added by merge
- bookmarks added by merge
- tree ordering exactly as it was before merge

Snapshot replace is the safest implementation.

## Migration Strategy

Do not rewrite all operations at once.

Suggested slices:

1. Introduce clone helpers and command/history abstractions
2. Wire handler history stacks and history endpoints
3. Convert rename + bookmark edit
4. Convert delete + bulk delete
5. Convert move + multi-move
6. Convert bulk refreshes
7. Convert import/merge
8. Add frontend buttons and shortcuts
9. Add selection restoration polish

Each slice should leave the app in a working state.

## Recommended Non-Goals For The First Pass

Avoid these until the base history system is proven:

- undo stack persistence
- arbitrary stack size UI
- command grouping across separate user actions
- undo for file creation/open
- tree diff visualization in history

## Acceptance Criteria

This feature is done when:

1. a user can perform move, delete, rename, bookmark edit, bulk delete, bulk title refresh, bulk favicon refresh, and import/merge
2. each of those actions creates exactly one undo history entry
3. undo restores the prior tree and saves it to disk
4. redo reapplies the tree change and saves it to disk
5. loading another file clears history
6. keyboard shortcuts respect current history state correctly
7. tests cover structural restoration, stack transitions, and save-failure behavior
