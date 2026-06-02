# Pain Point 5: tree-state.js at 1017 lines is too big

## Problem

`frontend/src/features/tree/state/tree-state.js` owns too many concerns:
- Tree data signals and computed indexes
- Selection signals, actions, and selectors
- Expansion state and visibility queries
- Tree mutations (insert, patch, move)
- Async load/restore workflows
- Search index coordination
- Scroll position tracking

The maintainability guidelines say 600+ lines needs justification. At 1017 lines, this is the biggest file in the frontend.

## Current Supporting Modules

Already extracted but still heavily coupled:
- `selection.js` (312 lines) - pure selection logic functions (no signals)
- `persistence.js` (77 lines) - persistence helpers
- `expansion.js` (82 lines) - expansion logic functions
- `structure.js` (192 lines) - tree structure queries

These modules contain pure functions but the signals, actions, and selectors that drive them all live in tree-state.js.

## Goal

Split tree-state.js into focused submodules while keeping the public `treeState` API surface unchanged for all 22 consumers. Target: tree-state.js reduced to ~200-250 lines (mostly re-exports and signal declarations).

## Strategy

All signals remain in tree-state.js (single source of truth). Extracted modules import the signals they need directly. tree-state.js imports extracted modules and re-exports their public APIs.

This avoids:
- Moving signals between modules (risky, changes all consumers)
- Circular dependencies
- API surface changes for 22 existing consumers

## Responsibilities After Split

### tree-state.js (~200-250 lines)
- All 9 signals (tree, primarySelectedNodeId, selectedNodeIds, selectionAnchorNodeId, expandedNodeIds, treeScrollTop, loading, error, treeStats)
- Computed values (nodeIndex, selectedNodeIdsSet)
- Orchestrator actions that span multiple concerns (revealAndSelectNode, toggleExpand, loadFile, restoreUIState, refresh)
- Simple accessor selectors (getTree, getSelectedNodeId, getSelectedNodeIds, getSelectionAnchorNodeId, getExpandedNodeIds, getTreeScrollTop, isLoading, getError, getTreeStats)
- Re-exports from submodules

### selection-state.js (~250 lines)
Selection actions and selectors currently in tree-state.js:
- Actions: selectSingle, clearSelection, setPrimarySelected, toggleSelected, selectRange, selectSiblingRange, extendSelectionByOffset, selectAllSiblings, collapseSelectionToPrimary, restoreSelectionSnapshot
- Selectors: isSelected, getSelectedNodes, getPrimarySelectedNode, canJoinSelection, getSiblingIds, captureSelectionSnapshot

### expansion-state.js (~100 lines)
Expansion actions and selectors currently in tree-state.js:
- Actions: expandAncestors
- Selectors: isExpanded, getVisibleNodeEntries, getVisibleNodeIds, getFolderNodeIds

### tree-mutations.js (~250 lines)
Tree mutation logic currently in tree-state.js:
- Actions: insertFlatNode, patchBookmark, patchFlatNodes, applyMoveResult, loadFolderChildren
- Internal helpers: createTreeNodeFromFlatNode, getLoadedFolderPath, getLoadedChildrenForParent, removeNodeFromChildren, getAncestorChainFromFlatTree

### load-workflow.js (~150 lines)
Async loading workflows currently in tree-state.js:
- Internal: syncTreeState, syncRootNodes, syncSearchIndex
- Note: loadFile and restoreUIState stay in tree-state.js as orchestrators

## Tasks

### Task 1: Create selection-state.js

Create `frontend/src/features/tree/state/selection-state.js` with selection actions and selectors.

**Extract these from tree-state.js (lines ~135-313):**
- `selectSingle(id)` - select a single node
- `clearSelection()` - clear all selection
- `setPrimarySelected(id)` - set primary in multi-selection
- `toggleSelected(id)` - Ctrl/Cmd+click toggle
- `selectRange(targetId, visibleIds)` - shift-click range
- `selectSiblingRange(targetId)` - select all siblings
- `extendSelectionByOffset(offset)` - arrow key extend
- `selectAllSiblings()` - select all siblings of primary
- `collapseSelectionToPrimary()` - reduce to primary only
- `restoreSelectionSnapshot(snapshot)` - restore from snapshot
- `isSelected(id)` - check if node is selected
- `getSelectedNodes()` - get selected node objects
- `getPrimarySelectedNode()` - get primary selected node
- `canJoinSelection(candidateId)` - check multi-select eligibility
- `getSiblingIds(id)` - get sibling IDs
- `captureSelectionSnapshot()` - capture current selection

**Imports needed:**
```js
import { computed, signal } from "../../../shared/runtime/naf.js";
import { createEmptySelectionState, createSingleSelectionState, ... } from "./selection.js";
import { getAncestorIdsFromTree, getChildIndexById, getNodeById, ... } from "./structure.js";
```

**Signal access:** Import tree, primarySelectedNodeId, selectedNodeIds, selectionAnchorNodeId from tree-state.js.

**Export:**
```js
export const selectionActions = { selectSingle, clearSelection, ... };
export const selectionSelectors = { isSelected, getSelectedNodes, ... };
```

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 2: Create expansion-state.js

Create `frontend/src/features/tree/state/expansion-state.js` with expansion actions and selectors.

**Extract these from tree-state.js (lines ~319-380):**
- `expandAncestors(id)` - expand all ancestors of a node
- `isExpanded(id)` - check if folder is expanded
- `getVisibleNodeEntries(nodes)` - visible entries given expansion
- `getVisibleNodeIds()` - visible node IDs
- `getFolderNodeIds(nodes)` - all folder node IDs

**Imports needed:**
```js
import { expandAncestorIds, getDefaultExpandedFolderIds, getFolderNodeIdsFromState, ... } from "./expansion.js";
```

**Signal access:** Import tree, expandedNodeIds from tree-state.js.

**Export:**
```js
export const expansionActions = { expandAncestors };
export const expansionSelectors = { isExpanded, getVisibleNodeEntries, getVisibleNodeIds, getFolderNodeIds };
```

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 3: Create tree-mutations.js

Create `frontend/src/features/tree/state/tree-mutations.js` with tree mutation logic.

**Extract these from tree-state.js (lines ~391-667):**
- `insertFlatNode(parentId, flatNode, index)` - insert a new node
- `patchBookmark(id, patch, notify)` - patch existing bookmark
- `patchFlatNodes(flatNodes)` - patch multiple bookmarks
- `applyMoveResult(result)` - apply a move operation
- `loadFolderChildren(folderId)` - lazy-load folder children
- Internal: `createTreeNodeFromFlatNode(flatNode)`
- Internal: `getLoadedFolderPath(folderId)`
- Internal: `getLoadedChildrenForParent(parentId)`
- Internal: `removeNodeFromChildren(nodes, nodeId)`
- Internal: `getAncestorChainFromFlatTree(selectedId, flatTree)`

**Imports needed:**
```js
import { GetFlatIndex, GetFolderChildren, GetFlatTree } from "../../../shared/api/api.js";
import { searchState } from "../../search/state/search-state.js";
import { normalizeFlatInWorker } from "../workers/tree-worker-client.js";
import { getNodeById } from "./structure.js";
```

**Signal access:** Import tree, expandedNodeIds from tree-state.js.
**Computed access:** Import nodeIndex (or recompute locally).

**Export:**
```js
export const mutationActions = { insertFlatNode, patchBookmark, patchFlatNodes, applyMoveResult, loadFolderChildren };
```

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 4: Create load-workflow.js

Create `frontend/src/features/tree/state/load-workflow.js` with async loading helpers.

**Extract these from tree-state.js (lines ~737-764):**
- `syncTreeState()` - full tree sync from Go
- `syncRootNodes()` - initial root load
- `syncSearchIndex()` - refresh search index only

**Imports needed:**
```js
import { GetFlatIndex, GetFlatTree, GetRootNodes, GetTreeStats } from "../../../shared/api/api.js";
import { searchState } from "../../search/state/search-state.js";
import { buildSearchIndexInWorker } from "../../search/workers/search-worker-client.js";
import { normalizeFlatInWorker } from "../workers/tree-worker-client.js";
import { pruneSelectionState } from "./persistence.js";
```

**Signal access:** Import tree, treeStats, selectedNodeIds, primarySelectedNodeId, selectionAnchorNodeId from tree-state.js.

**Export:**
```js
export { syncTreeState, syncRootNodes, syncSearchIndex };
```

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

### Task 5: Update tree-state.js to re-export

Rewrite tree-state.js to import from submodules and re-export through the existing `treeState` object.

**Structure:**
```js
// @ts-check

import { computed, signal } from "../../../shared/runtime/naf.js";
import { searchState } from "../../search/state/search-state.js";
import { normalizeFlatInWorker } from "../workers/tree-worker-client.js";
// ... other imports

// === Signals (unchanged) ===
const tree = signal([]);
const primarySelectedNodeId = signal("");
// ... etc

// === Computed (keep nodeIndex, selectedNodeIdsSet) ===
const nodeIndex = computed(() => { ... });

// === Import submodules ===
import { selectionActions, selectionSelectors } from "./selection-state.js";
import { expansionActions, expansionSelectors } from "./expansion-state.js";
import { mutationActions } from "./tree-mutations.js";
import { syncTreeState, syncRootNodes, syncSearchIndex } from "./load-workflow.js";

// === Orchestrator actions (span multiple concerns) ===
// revealAndSelectNode, toggleExpand, loadFile, restoreUIState, refresh

// === Export ===
export const treeState = {
  signals: { tree, primarySelectedNodeId, ... },
  computed: { selectionCount, hasMultiSelection },
  actions: {
    ...selectionActions,
    ...expansionActions,
    ...mutationActions,
    loadFile,
    refresh,
    revealAndSelectNode,
    toggleExpand,
    restoreUIState,
    setTreeScrollTop,
    setTree,
    setError,
  },
  selectors: {
    ...selectionSelectors,
    ...expansionSelectors,
    isExpanded,
    isSelected,
    getNode,
    getNodeType,
    getParentNode,
    getParentId,
    getChildIndex,
    getTree,
    getSelectedNodeId,
    getSelectedNodeIds,
    getSelectionAnchorNodeId,
    getExpandedNodeIds,
    getTreeScrollTop,
    isLoading,
    getError,
    getTreeStats,
    captureSelectionSnapshot,
    getPersistentState,
    getAncestorIds,
  },
};
```

**Target:** ~200-250 lines total.

**Verification:** `cd frontend && npm run typecheck && npm run build`

---

## Execution Order

Tasks must be executed in order: 1 -> 2 -> 3 -> 4 -> 5.

Each task is independently verifiable with `npm run typecheck && npm run build`.

Task 5 is the final integration step where tree-state.js becomes the thin coordinator.

## Risk Mitigation

- **No consumer changes needed** - the `treeState` export shape is preserved
- **Signals stay in one place** - no risk of split-brain state
- **Mechanical extraction** - copy functions, update imports, re-export
- **Incremental verification** - each task verified independently
- **Orchestrators stay in tree-state.js** - functions that span concerns (revealAndSelectNode, toggleExpand, loadFile, restoreUIState) remain in the coordinator

## Functions That Stay in tree-state.js

These span multiple concerns and are better as orchestrators:

1. `revealAndSelectNode(id)` - loads folders + selects (loading + selection)
2. `toggleExpand(id)` - expands + loads children (expansion + loading)
3. `loadFile(path)` - clears state + loads + restores (loading + selection + expansion)
4. `restoreUIState(state)` - restores expansion + selection + loads folders
5. `refresh()` - calls syncTreeState
6. `getSelectionState()` / `applySelectionState()` - internal helpers
7. `pruneSelection()` - selection + persistence crossover
8. `getPersistentState()` - persistence selector
9. `setTreeScrollTop()` / `getTreeScrollTop()` - simple scroll accessors
10. `getAncestorIds()` - simple tree query (already delegates to structure.js)
11. `getNode()`, `getNodeType()`, `getParentNode()`, `getParentId()`, `getChildIndex()` - simple tree queries

These are all thin wrappers or orchestrators, keeping tree-state.js focused on coordination.

## Expected Result

| Module | Lines | Responsibility |
|--------|-------|----------------|
| tree-state.js | ~200-250 | Signals, computed, orchestrators, re-exports |
| selection-state.js | ~250 | Selection actions and selectors |
| expansion-state.js | ~100 | Expansion actions and selectors |
| tree-mutations.js | ~250 | Tree mutations (insert, patch, move) |
| load-workflow.js | ~150 | Async sync helpers |
| selection.js | 312 (unchanged) | Pure selection logic |
| persistence.js | 77 (unchanged) | Persistence helpers |
| expansion.js | 82 (unchanged) | Pure expansion logic |
| structure.js | 192 (unchanged) | Tree structure queries |

Total lines: similar to before, but distributed across focused modules.
