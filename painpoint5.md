# Pain Point 5: tree-state.js at 1017 lines is too big -- RESOLVED

## Problem

`frontend/src/features/tree/state/tree-state.js` owned too many concerns:
- Tree data signals and computed indexes
- Selection signals, actions, and selectors
- Expansion state and visibility queries
- Tree mutations (insert, patch, move)
- Async load/restore workflows
- Search index coordination
- Scroll position tracking

The maintainability guidelines say 600+ lines needs justification. At 1017 lines, this was the biggest file in the frontend.

## Resolution

tree-state.js split into 4 focused submodules while keeping the public `treeState` API surface unchanged for all 22 consumers.

### Module counts after split

| Module | Lines | Responsibility |
|--------|-------|----------------|
| tree-state.js | 466 | Signals, computed, orchestrators, re-exports |
| selection-state.js | 232 | Selection actions and selectors |
| expansion-state.js | 74 | Expansion actions and selectors |
| tree-mutations.js | 419 | Tree mutations (insert, patch, move) |
| load-workflow.js | 81 | Async sync helpers |
| selection.js | 312 (unchanged) | Pure selection logic |
| persistence.js | 77 (unchanged) | Persistence helpers |
| expansion.js | 82 (unchanged) | Pure expansion logic |
| structure.js | 192 (unchanged) | Tree structure queries |

Total: 1935 lines (was 1017 in tree-state.js alone, now distributed)

### Signals exported from tree-state.js

- tree, primarySelectedNodeId, selectedNodeIds, selectionAnchorNodeId, expandedNodeIds, treeStats, nodeIndex

### Orchestrators kept in tree-state.js

- revealAndSelectNode, toggleExpand, loadFile, restoreUIState, refresh

### Additional changes

- globals.d.ts: Fixed Signal<T> type to match actual NAF runtime: `(() => T) & ((value: T) => T)`
- globals.d.ts: Added SelectionSnapshot interface
- bookmark-tree-dnd.js, bookmark-tree-keyboard.js: Added explicit type casts for getVisibleNodeEntries() return value

### Verification

- `npm run typecheck` -- passed
- `npm run build` -- passed (125.33 kB bundle)

### Files changed

- frontend/src/globals.d.ts
- frontend/src/features/tree/state/tree-state.js
- frontend/src/features/tree/state/selection-state.js (new)
- frontend/src/features/tree/state/expansion-state.js (new)
- frontend/src/features/tree/state/tree-mutations.js (new)
- frontend/src/features/tree/state/load-workflow.js (new)
- frontend/src/features/tree/interactions/bookmark-tree-dnd.js
- frontend/src/features/tree/interactions/bookmark-tree-keyboard.js
