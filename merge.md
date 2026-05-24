# Bookmark File Merge Implementation Plan

## Evaluation

This feature is a strong fit for the app, but it needs explicit scope boundaries to avoid turning into a full sync engine.

### Why it fits

- The app already has a clear single-source-of-truth model: one in-memory tree backed by a Netscape bookmarks HTML file.
- The parser/serializer and auto-save flow already exist, so merge can be modeled as:
  1. parse second file
  2. compute a merge preview
  3. apply approved additions to the current tree
  4. save once

### Main design constraints

1. Parsed node IDs are not stable across files.
   - `bookmarks.Parse()` generates fresh IDs every time.
   - Merge identity must be based on content and structural location, not IDs.

2. “Exact duplicate” needs a project-level definition.
   - Without this, the merge result will be inconsistent and hard to explain in the approval report.

3. Folder matching is ambiguous.
   - Two folders with the same name in different branches are distinct.
   - Matching must use folder path context, not name alone.

4. Deletions are a separate problem.
   - The user request describes additive sync of browser-exported changes back into the original file.
   - v1 should not delete anything from the current file.

5. Reordering should be out of scope for v1.
   - Netscape bookmark files preserve order, but computing reorder diffs is much more complex than additive merge.

### Recommended v1 semantics

Treat import/merge as an additive operation only:

- existing folders are reused when their path already exists
- existing bookmarks are left untouched when an exact duplicate already exists
- incoming bookmarks/folders that do not already exist are added
- no deletions
- no reordering of existing items
- no overwrite of existing bookmark title/meta/icon in v1

This matches the stated browser round-trip use case and is much safer than trying to infer destructive intent.

## Proposed Merge Rules

### Folder identity

Folders should be matched by full path from the root:

- `Programming / Go / Blogs`
- `Bookmarks Bar / Work / GitHub`

Rules:

- if an incoming folder path already exists, reuse it
- if an incoming folder path does not exist, create the missing folder nodes along that path

### Bookmark identity

For v1, define an exact duplicate bookmark as:

- same parent folder path
- same URL
- same title

Rationale:

- URL alone is too aggressive and would collapse intentionally distinct bookmarks with different labels in the same folder
- including parent path prevents cross-folder duplicates from being treated as identical
- including title makes “exact duplicate” easy to explain in the report

Optional future refinement:

- compare normalized URLs
- compare notes/meta
- detect “same URL, different title” as a conflict/update candidate

### Non-duplicate incoming bookmark

An incoming bookmark should be added when:

- its parent folder path exists or can be created
- no exact duplicate bookmark exists in that same folder path

### Conflict handling in v1

Keep v1 intentionally simple:

- exact duplicates: ignored
- non-duplicates: added
- “same URL but different title/meta/icon in same folder”: show as a separate report category such as `Potential updates`, but do not auto-apply them in v1

This gives the user visibility without taking risky overwrite actions.

## User Experience

### Entry point

Add an `Import` action when a bookmark file is already open.

Recommended location:

- `SearchBar` action row, near `Open File` and `New File`

### Flow

1. User opens a primary bookmark file.
2. User clicks `Import`.
3. Native file picker selects a second bookmark file.
4. App parses the second file and computes a merge preview against the currently loaded tree.
5. User sees a report before anything is changed.
6. User can:
   - `Apply Merge`
   - `Cancel`
7. If applied:
   - additions are merged into the current in-memory tree
   - current file is saved once
   - tree refreshes
   - toast confirms result

### Preview report content

Minimum report sections:

- `Folders to add`
- `Bookmarks to add`
- `Exact duplicates ignored`
- `Potential updates not applied`

Each row should include enough context to understand location:

- folder path
- bookmark title
- bookmark URL

Summary counts at top:

- folders to add: `N`
- bookmarks to add: `N`
- duplicates ignored: `N`
- potential updates: `N`

### Empty merge case

If the import has no additive changes:

- do not show an approval dialog
- show a toast like `No new changes found`

## Architecture

## Phase 1: Domain Diff Model

Files:

- `internal/bookmarks/model.go`
- new: `internal/bookmarks/merge.go`
- new: `internal/bookmarks/merge_test.go`

Add merge-domain structs:

```go
type MergePreview struct {
    FoldersToAdd         []FolderMergeItem
    BookmarksToAdd       []BookmarkMergeItem
    DuplicateBookmarks   []BookmarkMergeItem
    PotentialUpdates     []BookmarkConflictItem
}

type FolderMergeItem struct {
    Path string
    Name string
}

type BookmarkMergeItem struct {
    FolderPath string
    Title      string
    URL        string
}

type BookmarkConflictItem struct {
    FolderPath     string
    ExistingTitle  string
    IncomingTitle  string
    URL            string
    ExistingMeta   string
    IncomingMeta   string
}
```

Add helpers for:

- building folder paths from the current tree
- indexing folders by full path
- indexing bookmarks by `(folder path, title, url)`
- detecting same-folder same-URL but differing title/meta

Important:

- keep preview computation pure
- do not mutate the current tree while building the preview

## Phase 2: Merge Engine

Files:

- `internal/bookmarks/merge.go`
- `internal/bookmarks/operations.go` or keep merge isolated in `merge.go`

Add two core functions:

```go
func PreviewMerge(existing []Node, incoming []Node) (MergePreview, error)
func ApplyMerge(existing []Node, incoming []Node) ([]Node, MergeApplyResult, error)
```

Recommended separation:

- `PreviewMerge` computes everything needed for the dialog
- `ApplyMerge` reuses the same matching rules and performs only additive changes

Apply rules:

- create missing folder paths in path order
- append new bookmarks to the matching folder
- skip exact duplicates
- do not modify existing bookmarks for potential updates

`MergeApplyResult` should include counts for the success toast:

```go
type MergeApplyResult struct {
    FoldersAdded   int
    BookmarksAdded int
    DuplicatesSkipped int
    PotentialUpdates int
}
```

## Phase 3: Backend API

Files:

- `internal/wailsapi/handler.go`
- `frontend/src/lib/api.ts`
- `frontend/src/vite-env.d.ts`

Add Wails endpoints:

```go
func (h *Handler) PreviewImportMerge(path string) (bookmarks.MergePreview, error)
func (h *Handler) ApplyImportMerge(path string) (bookmarks.MergeApplyResult, error)
```

Backend flow:

### `PreviewImportMerge`

- read selected import file
- parse into `incoming []Node`
- compare against `h.tree`
- return preview only

### `ApplyImportMerge`

- re-read and re-parse the import file
- apply merge against `h.tree`
- save current open file once
- return result counts

Why re-read on apply:

- avoids trusting stale preview data
- ensures apply uses the exact file contents on disk at approval time

Validation:

- current file must already be loaded
- import path must be readable
- import file must parse successfully
- importing the same file path as the currently open file should be allowed but will likely yield no changes; do not special-case reject unless it causes confusion

## Phase 4: Frontend Types and API Bindings

Files:

- `frontend/src/lib/types.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/vite-env.d.ts`

Add TS types mirroring the preview/result payloads.

Suggested types:

```ts
export interface MergePreview {
  foldersToAdd: FolderMergeItem[];
  bookmarksToAdd: BookmarkMergeItem[];
  duplicateBookmarks: BookmarkMergeItem[];
  potentialUpdates: BookmarkConflictItem[];
}

export interface MergeApplyResult {
  foldersAdded: number;
  bookmarksAdded: number;
  duplicatesSkipped: number;
  potentialUpdates: number;
}
```

## Phase 5: Import/Merge Dialog UI

Files:

- new: `frontend/src/lib/components/ImportMergeDialog.svelte`
- new: `frontend/src/lib/stores/importMergeStore.svelte.ts`
- `frontend/src/App.svelte`
- `frontend/src/lib/components/SearchBar.svelte`

Store responsibilities:

- whether dialog is open
- selected import path
- preview loading state
- apply loading state
- preview payload
- error state

UI responsibilities:

- choose import file
- display summary counts
- render preview sections
- allow cancel/apply

Recommended dialog structure:

- Header: `Import and Merge`
- File path row
- Summary cards/counts
- Tabbed or stacked sections:
  - `Add folders`
  - `Add bookmarks`
  - `Duplicates ignored`
  - `Potential updates`
- Footer actions:
  - `Cancel`
  - `Apply Merge`

## Phase 6: App Integration

Files:

- `frontend/src/App.svelte`
- `app.go` if a dedicated import-file picker method is preferred

Options:

1. Reuse `OpenFilePicker()`
2. Add dedicated `OpenImportFilePicker()` with merge-specific dialog title

Recommendation:

- add `OpenImportFilePicker()` for clearer UX text

After apply succeeds:

- `await treeStore.refresh()`
- keep current file session open
- preserve current file path
- optionally clear search if imported changes should be easier to inspect

## Phase 7: Preview Detail Quality

This phase is about making the report understandable, not just technically correct.

Recommended display details:

- folders: show full path
- bookmarks: show title, URL, folder path
- conflicts: show existing vs incoming title and maybe meta

Recommended sorting:

- sort preview items by folder path, then title

This matters because an unsorted diff report will feel random and untrustworthy.

## Phase 8: Tests

Files:

- new: `internal/bookmarks/merge_test.go`
- possibly extend `internal/wailsapi/handler_test.go`

Required domain tests:

1. identical files produce no additions
2. incoming new bookmark under existing folder is detected and added
3. incoming new nested folder path is created
4. exact duplicate bookmark is ignored
5. same URL, same folder, different title is reported as potential update
6. same folder names in different branches stay distinct by path
7. root-level folder creation works
8. empty import file yields empty preview

Required handler tests:

1. preview import parse failure returns error
2. apply import saves once and updates tree
3. apply with no changes returns zero-add summary

## Phase 9: Explicit Non-Goals for v1

Do not include these in the first implementation:

- deleting items absent from the imported file
- rewriting existing bookmark titles/meta/icons automatically
- folder rename detection
- reorder sync
- three-way merge
- conflict resolution editing in the preview dialog
- URL canonicalization beyond exact string match

## Implementation Order

1. Define merge semantics and preview/result structs in Go
2. Implement pure merge preview logic with tests
3. Implement merge apply logic with tests
4. Expose backend preview/apply endpoints
5. Add frontend types and API bindings
6. Add import picker + dialog UI
7. Wire dialog into the main app
8. Verify save/refresh behavior and empty-merge UX

## Notes for Future Versions

If v1 lands well, the next logical upgrade is:

- conflict-aware updates for same URL within the same folder
- optional overwrite rules
- optional delete/missing-item detection
- URL normalization and dedupe cleanup tools

That should be a separate feature phase, not folded into the initial merge implementation.
