# justbookmarks — Product Requirements Document

## Overview

A desktop GUI bookmark manager that reads and writes the Netscape Bookmarks HTML format. Designed to manage bookmarks outside of any browser, enabling easy import into multiple browsers from a single source of truth.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | Wails v2.12.0 |
| Backend | Go |
| Frontend | Svelte 5 (runes) |
| CSS | Tailwind CSS v4 + DaisyUI |
| Distribution | Pre-compiled binaries via GitHub Releases |
| Testing | Go unit tests (parser, serializer, CRUD) |

## File Format

**Netscape Bookmarks HTML Format** — the single source of truth. The app parses this into an in-memory Go struct tree, all edits happen in memory, and changes are serialized back to the same HTML file on save.

Key elements handled:
- `<H3>` tags = folders (attributes: `ICON`, `ADD_DATE`, `LAST_MODIFIED`, `META`)
- `<A>` tags = bookmarks (attributes: `HREF`, `ADD_DATE`, `LAST_MODIFIED`, `ICON`, `ICON_URI`, `META`)
- `<DT>`, `<DL>`, `<P>` = structural containers
- Arbitrary nesting depth for folders
- Order of items within each folder is preserved

## File Opening Model

Single file per session. The app requires a bookmark HTML file path on launch:
- CLI argument: `justbookmarks ~/bookmarks.html`
- If launched without arguments, show a file picker dialog

The entire session is bound to that one file. No Open/Save/Save As menu — the file is opened once and auto-saved continuously.

## Save Strategy

Auto-save on every change. Every add, edit, delete, or reorder writes immediately to the HTML file. No manual save, no dirty-state indicator, no undo stack.

## UI Layout

Two-pane layout:

```
+----------------------------------------------------------+
| [Search bar]                                    [New] [+] |
+------------------------------------+---------------------+
|                                    |                     |
|  LEFT PANE: Tree View              |  RIGHT PANE:        |
|                                    |  Detail / Edit      |
|  [v] Bookmarks Bar                 |  -----------------  |
|    [v] Work                        |                     |
|      [B] GitHub                   |  When folder selected:|
|      [B] Linear                   |  - Folder name (editable)
|    [v] Personal                   |  - Child count
|      [B] YouTube                  |  - "Add Bookmark" button
|      [B] Reddit                   |  - "Add Folder" button
|  [v] Other Bookmarks              |                     |
|    [B] Speed Dial                 |  When bookmark selected:
|                                    |  - Title (editable)
|  Legend: [v]=folder, [B]=bookmark  |  - URL (editable)
|                                    |  - Icon preview + "Fetch"
|                                    |  - Add Date, Last Modified
|                                    |  - Notes/Meta field
|                                    |  - "Open in Browser" button
|                                    |  - Up/Down reorder arrows
|                                    |  - "Move To..." button
|                                    |  - "Delete" button
+------------------------------------+---------------------+
```

### Tree Interaction

- **Expand/collapse:** Chevron/disclosure icon on each folder row. Clicking the chevron toggles children visibility.
- **Select:** Clicking anywhere on a row selects it and shows details in the right pane.
- **Folder selection:** Shows folder edit panel (name, child count, add buttons).
- **Bookmark selection:** Shows full edit form.
- **Keyboard:** Arrow keys navigate the tree. Space/Enter expands or collapses folders.
- **Drag-and-drop:** Drag a bookmark or folder to reorder within its parent or drop into another folder to move it.

### Search

- Search bar at the top spanning the full width.
- Client-side filtering using a flat index of all bookmarks with their folder paths.
- Implemented as a Svelte `$derived` value that filters on the search query.
- When search is active, the tree collapses and shows only matching results with their folder paths.

## Core Features (v1)

### CRUD Operations

1. **Add bookmark** — Enter URL (auto-fetches title), optional title override, select target folder.
2. **Add folder** — Enter folder name, select parent folder. Supports nested creation.
3. **Edit bookmark** — Modify title, URL, notes/meta. Triggered from right pane.
4. **Edit folder** — Modify folder name. Triggered from right pane.
5. **Delete bookmark** — Remove a single bookmark.
6. **Delete folder** — Remove a folder and all its children. Confirmation modal required.
7. **Move** — Drag-and-drop a bookmark or folder to a new location in the tree.

### Navigation

- Collapsible tree view showing folders and bookmarks inline.
- Click to select, chevron to expand/collapse.
- Keyboard navigation with arrow keys.

### Search

- Full-text search across bookmark titles and URLs.
- Client-side flat index for instant filtering.

### Title Auto-Fetch

- When a user types a URL in the add/edit form, wait 800ms of inactivity (debounce).
- Fetch the page's `<title>` tag via HTTP GET with a 3-second timeout.
- Auto-fill the title field if fetch succeeds.
- If fetch fails or times out, leave the title blank (user fills it manually).
- Show a small spinner indicator while fetching.

### Favicon Handling

- Preserve existing `ICON` (inline base64) and `ICON_URI` attributes from the HTML file.
- Display inline icons in the tree view when available, fallback to a default icon.
- **Manual fetch:** "Fetch Favicon" button in the bookmark edit panel. Fetches from Google's favicon service (`https://www.google.com/s2/favicons?domain=DOMAIN&sz=32`). Stores the result as inline base64 `ICON` attribute.
- No automatic favicon fetching.

### Open in Browser

- "Open in Browser" button in the bookmark detail panel.
- Uses the OS default browser via Go's `net/http` + `os/exec` (or Wails browser runtime).

### Error Handling

- **Critical errors** (file open failure, save failure, permission denied): Modal dialog. User must acknowledge.
- **Warnings** (favicon fetch failed, duplicate URL in folder): Non-blocking toast notification.
- **Form validation:** Inline errors on form fields (red border, error text).
  - URL must be valid (scheme + host, or valid `file://` path).
  - Title is optional — defaults to URL if left blank after title fetch fails.
  - Folder name cannot be empty.
- **Circular move prevention:** Cannot move a folder into itself or its own descendant.

## Out of Scope for v1

- Bulk operations (multi-select, delete all, move all)
- Duplicate detection (beyond warning on same-folder duplicates)
- Auto-fetch favicons
- Tags or categories on bookmarks
- Multiple bookmark files / profiles in a single session
- Bookmarks bar vs Other Bookmarks separation
- Import/export to formats other than Netscape HTML
- User accounts or authentication

## Project Structure

```
justbookmarks/
├── wails.json
├── go.mod / go.sum
├── main.go
├── build/
│   └── appicon.png
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── svelte.config.js
│   ├── src/
│   │   ├── main.js
│   │   ├── App.svelte
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── store.js
│   │   │   ├── BookmarkTree.svelte
│   │   │   ├── BookmarkList.svelte
│   │   │   ├── BookmarkForm.svelte
│   │   │   ├── FolderForm.svelte
│   │   │   ├── MoveDialog.svelte
│   │   │   ├── SearchBar.svelte
│   │   │   └── types.js
│   │   └── styles/
│   │       └── global.css
│   └── index.html
├── cmd/
│   └── justbookmarks/
│       └── main.go
├── internal/
│   ├── bookmarks/
│   │   ├── model.go
│   │   ├── parser.go
│   │   ├── serializer.go
│   │   └── operations.go
│   └── wailsapi/
│       └── handler.go
└── prd.md
```

## Go Data Model

```go
type Bookmark struct {
    ID          string    // unique identifier (generated)
    Title       string
    URL         string
    Icon        string    // inline base64 data URI
    IconURI     string    // URL to icon
    AddDate     time.Time
    LastModified time.Time
    Meta        string    // notes/misc metadata
}

type Folder struct {
    ID          string
    Name        string
    Icon        string
    AddDate     time.Time
    LastModified time.Time
    Meta        string
    Children    []TreeNode // folders and bookmarks mixed
}

type TreeNode struct {
    IsFolder bool
    Folder   *Folder
    Bookmark *Bookmark
}
```

## Wails API Bindings (handler.go)

```go
type Handler struct {
    FilePath string
    Tree     *TreeNode  // root node
}

// Tree operations
func (h *Handler) LoadFile(path string) error
func (h *Handler) GetTree() *TreeNode
func (h *Handler) AddBookmark(parentID string, bm Bookmark) string  // returns new ID
func (h *Handler) AddFolder(parentID string, name string) string    // returns new ID
func (h *Handler) UpdateBookmark(id string, bm Bookmark) error
func (h *Handler) UpdateFolder(id string, name string) error
func (h *Handler) DeleteNode(id string) error
func (h *Handler) MoveNode(id string, newParentID string, newIndex int) error

// Utility
func (h *Handler) FetchPageTitle(url string) (string, error)
func (h *Handler) FetchFavicon(url string) (string, error)  // returns base64 icon
func (h *Handler) OpenURL(url string) error
```

## Frontend Stores

- **treeStore** — Full bookmark tree, selected node ID, CRUD operations via Wails API calls.
- **searchStore** — Search query string, flat index of all bookmarks, derived filtered results.
- **uiStore** — Modal state (confirm delete, file picker), toast queue, loading indicators.

## Distribution

Pre-compiled binaries per platform via GitHub Releases:
- Linux: `.deb` and `.AppImage`
- macOS: `.dmg`
- Windows: `.exe` installer

Built with `wails build` in GitHub Actions on tag pushes.
