# justbookmarks v1 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a desktop GUI bookmark manager (Wails v2 + Go + Svelte 5) that reads/writes Netscape Bookmarks HTML files.

**Architecture:** Go backend owns the domain logic (parse, serialize, CRUD, file I/O). Wails exposes bindings to a Svelte 5 frontend with Tailwind v4 + DaisyUI. Single file opened at startup, auto-saved on every change.

**Tech Stack:** Wails v2.12.0, Go 1.22+, Svelte 5 (runes), Tailwind CSS v4, DaisyUI, `golang.org/x/net/html`

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Wails project

**Objective:** Bootstrap the Wails v2 project with Go module and basic app shell.

**Files:**
- Create: `go.mod`
- Create: `wails.json`
- Create: `main.go`
- Create: `build/appicon.png`

**Step 1: Create go.mod**

```go
module github.com/SellswordSoftware/justbookmarks

go 1.22

require (
	github.com/wailsapp/wails/v2 v2.12.0
	golang.org/x/net v0.30.0
)
```

**Step 2: Create wails.json**

```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "justbookmarks",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto"
}
```

**Step 3: Create main.go**

```go
package main

import (
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2"
)

type App struct {
	ctx context.Context
	filePath string
}

func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OnShutdown(ctx context.Context) {
}

func main() {
	app := &App{}

	filePath := ""
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	err := wails.Run(&wails.Config{
		Build: wails.BuildConfig{
			DevTools: wails.DevToolsConfig{
				Open: true,
			},
		},
		Preview: wails.PreviewConfig{
			Enable: false,
		},
		DisableContextMenu: false,
		Width:              1200,
		Height:             800,
		Title:              "justbookmarks",
		OnStartup:          app.OnStartup,
		OnShutdown:         app.OnShutdown,
	})

	if err != nil {
		fmt.Println("Error:", err.Error())
	}
}
```

**Step 4: Create a placeholder app icon**

Create `build/appicon.png` — a simple placeholder PNG (can be a 256x256 colored square for now).

**Step 5: Verify**

Run: `wails dev`

Expected: Wails dev server starts, blank window opens.

**Step 6: Commit**

```bash
git add go.mod go.sum wails.json main.go build/
git commit -m "chore: initialize Wails v2 project scaffold"
```

---

### Task 2: Initialize Svelte 5 frontend with Vite, Tailwind v4, DaisyUI

**Objective:** Set up the Svelte 5 frontend with Tailwind CSS v4 and DaisyUI.

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/svelte.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.js`
- Create: `frontend/src/App.svelte`
- Create: `frontend/src/app.css`

**Step 1: Create frontend/package.json**

```json
{
  "name": "justbookmarks-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "vite": "^6.0.0"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "daisyui": "^5.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

**Step 2: Create frontend/vite.config.js**

```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(),
  ],
  server: {
    port: 8080,
  },
});
```

**Step 3: Create frontend/svelte.config.js**

```js
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default {
  plugins: [svelte()],
};
```

**Step 4: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>justbookmarks</title>
    <link href="/src/app.css" rel="stylesheet" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

**Step 5: Create frontend/src/app.css**

```css
@import "tailwindcss";
@plugin "daisyui";
```

**Step 6: Create frontend/src/main.js**

```js
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
```

**Step 7: Create frontend/src/App.svelte (placeholder)**

```svelte
<script>
  let greeting = $state('justbookmarks');
</script>

<div class="h-screen flex flex-col bg-base-200">
  <div class="navbar bg-base-100 shadow-sm">
    <div class="flex-1">
      <h1 class="text-lg font-bold">{greeting}</h1>
    </div>
  </div>
  <div class="flex-1 flex items-center justify-center">
    <p class="text-base-content/50">Loading bookmark file...</p>
  </div>
</div>
```

**Step 8: Install and verify**

Run: `cd frontend && npm install && cd ..`
Run: `wails dev`

Expected: Wails window opens showing "justbookmarks" navbar and loading text.

**Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Svelte 5 frontend with Tailwind v4 + DaisyUI"
```

---

## Phase 2: Go Data Model

### Task 3: Define the bookmark data model

**Objective:** Create the Go structs that represent the bookmark tree in memory.

**Files:**
- Create: `internal/bookmarks/model.go`

**Step 1: Write model.go**

```go
package bookmarks

import (
	"fmt"
	"time"
)

// NodeType distinguishes folders from bookmarks.
type NodeType int

const (
	TypeFolder   NodeType = iota
	TypeBookmark NodeType = iota
)

func (t NodeType) String() string {
	switch t {
	case TypeFolder:
		return "folder"
	case TypeBookmark:
		return "bookmark"
	default:
		return "unknown"
	}
}

// Bookmark represents a single bookmark entry.
type Bookmark struct {
	ID           string    // unique identifier, generated on parse
	Title        string
	URL          string
	Icon         string    // inline base64 data URI
	IconURI      string    // URL to icon
	AddDate      time.Time // empty if not set
	LastModified time.Time // empty if not set
	Meta         string    // notes or arbitrary metadata
}

// Folder represents a bookmark folder that can contain children.
type Folder struct {
	ID           string    // unique identifier, generated on parse
	Name         string
	Icon         string
	AddDate      time.Time
	LastModified time.Time
	Meta         string
	Children     []Node
}

// Node is a discriminated union of Folder or Bookmark.
type Node struct {
	Type     NodeType
	Folder   *Folder   // non-nil if TypeFolder
	Bookmark *Bookmark // non-nil if TypeBookmark
}

// ID returns the node's ID regardless of type.
func (n *Node) ID() string {
	switch n.Type {
	case TypeFolder:
		return n.Folder.ID
	case TypeBookmark:
		return n.Bookmark.ID
	default:
		return ""
	}
}

// Name returns the display name (folder name or bookmark title).
func (n *Node) Name() string {
	switch n.Type {
	case TypeFolder:
		return n.Folder.Name
	case TypeBookmark:
		return n.Bookmark.Title
	default:
		return ""
	}
}

// Children returns child nodes (folders only, panics for bookmarks).
func (n *Node) Children() []Node {
	if n.Type != TypeFolder {
		panic(fmt.Sprintf("cannot get children of %s", n.Type))
	}
	return n.Folder.Children
}

// HasChildren returns whether the node has children (always true for folders, false for bookmarks).
func (n *Node) HasChildren() bool {
	if n.Type != TypeFolder {
		return false
	}
	return len(n.Folder.Children) > 0
}

// GenerateID creates a simple unique ID using a counter.
var idCounter int64

func GenerateID() string {
	idCounter++
	return fmt.Sprintf("node-%d", idCounter)
}
```

**Step 2: Write a basic model test**

Create: `internal/bookmarks/model_test.go`

```go
package bookmarks

import (
	"testing"
)

func TestNodeID(t *testing.T) {
	folder := &Node{Type: TypeFolder, Folder: &Folder{ID: "f1", Name: "Test"}}
	if folder.ID() != "f1" {
		t.Errorf("expected f1, got %s", folder.ID())
	}

	bm := &Node{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1", Title: "Google", URL: "https://google.com"}}
	if bm.ID() != "b1" {
		t.Errorf("expected b1, got %s", bm.ID())
	}
}

func TestNodeName(t *testing.T) {
	folder := &Node{Type: TypeFolder, Folder: &Folder{ID: "f1", Name: "Work"}}
	if folder.Name() != "Work" {
		t.Errorf("expected Work, got %s", folder.Name())
	}

	bm := &Node{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1", Title: "GitHub"}}
	if bm.Name() != "GitHub" {
		t.Errorf("expected GitHub, got %s", bm.Name())
	}
}

func TestHasChildren(t *testing.T) {
	folder := &Node{Type: TypeFolder, Folder: &Folder{Children: []Node{}}}
	if folder.HasChildren() {
		t.Error("empty folder should have no children")
	}

	folder.Folder.Children = []Node{{Type: TypeBookmark}}
	if !folder.HasChildren() {
		t.Error("folder with children should report true")
	}

	bm := &Node{Type: TypeBookmark, Bookmark: &Bookmark{}}
	if bm.HasChildren() {
		t.Error("bookmark should never have children")
	}
}
```

**Step 3: Run tests**

Run: `go test ./internal/bookmarks/... -v`

Expected: 3 tests pass.

**Step 4: Commit**

```bash
git add internal/bookmarks/
git commit -m "feat: define bookmark data model (Node, Bookmark, Folder)"
```

---

## Phase 3: Netscape HTML Parser

### Task 4: Implement the HTML parser

**Objective:** Parse a Netscape Bookmarks HTML file into the in-memory Node tree.

**Files:**
- Create: `internal/bookmarks/parser.go`
- Create: `internal/bookmarks/parser_test.go`
- Create: `internal/bookmarks/testdata/simple.html`
- Create: `internal/bookmarks/testdata/nested.html`

**Step 1: Create test fixture — simple.html**

A minimal valid Netscape bookmark file with one folder and two bookmarks:

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000000">Bookmarks Bar</H3>
    <DL><p>
        <DT><A HREF="https://github.com" ADD_DATE="1700000001" ICON="data:image/png;base64,abc123">GitHub</A>
        <DT><A HREF="https://linear.app" ADD_DATE="1700000002">Linear</A>
    </DL><p>
</DL><p>
```

**Step 2: Create test fixture — nested.html**

A file with nested folders:

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Root Folder</H3>
    <DL><p>
        <DT><H3>Sub Folder</H3>
        <DL><p>
            <DT><A HREF="https://example.com">Example</A>
        </DL><p>
        <DT><A HREF="https://google.com">Google</A>
    </DL><p>
</DL><p>
```

**Step 3: Write parser.go**

Use `golang.org/x/net/html` to tokenize the HTML. Walk the token stream and build the tree:

Key parsing rules:
- `<H3>` opens a folder. Read attributes (ADD_DATE, LAST_MODIFIED, ICON, META). Text content = folder name.
- `<A>` creates a bookmark. Read attributes (HREF, ADD_DATE, LAST_MODIFIED, ICON, ICON_URI, META). Text content = title.
- `<DL>` and `<DT>` are structural — track nesting depth.
- `<P>` inside DL is a Netscape quirk — ignore it.
- ADD_DATE and LAST_MODIFIED are Unix timestamps as strings (seconds).
- Generate a unique ID for each node using `GenerateID()`.

The parser should return a `[]Node` (the root-level nodes).

**Step 4: Write parser_test.go**

```go
package bookmarks

import (
	"os"
	"testing"
)

func TestParseSimple(t *testing.T) {
	data, err := os.ReadFile("testdata/simple.html")
	if err != nil {
		t.Fatal(err)
	}

	nodes, err := Parse(data)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if len(nodes) != 1 {
		t.Fatalf("expected 1 root node, got %d", len(nodes))
	}

	root := nodes[0]
	if root.Type != TypeFolder {
		t.Fatal("expected root to be a folder")
	}
	if root.Folder.Name != "Bookmarks Bar" {
		t.Errorf("expected 'Bookmarks Bar', got '%s'", root.Folder.Name)
	}
	if len(root.Folder.Children) != 2 {
		t.Errorf("expected 2 children, got %d", len(root.Folder.Children))
	}

	bm := root.Folder.Children[0]
	if bm.Bookmark.URL != "https://github.com" {
		t.Errorf("expected github URL, got '%s'", bm.Bookmark.URL)
	}
	if bm.Bookmark.Title != "GitHub" {
		t.Errorf("expected 'GitHub', got '%s'", bm.Bookmark.Title)
	}
}

func TestParseNested(t *testing.T) {
	data, err := os.ReadFile("testdata/nested.html")
	if err != nil {
		t.Fatal(err)
	}

	nodes, err := Parse(data)
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}

	root := nodes[0]
	if root.Folder.Name != "Root Folder" {
		t.Errorf("expected 'Root Folder', got '%s'", root.Folder.Name)
	}

	subFolder := root.Folder.Children[0]
	if subFolder.Type != TypeFolder {
		t.Fatal("expected first child to be a folder")
	}
	if subFolder.Folder.Name != "Sub Folder" {
		t.Errorf("expected 'Sub Folder', got '%s'", subFolder.Folder.Name)
	}

	bm := subFolder.Folder.Children[0]
	if bm.Bookmark.URL != "https://example.com" {
		t.Errorf("expected example.com, got '%s'", bm.Bookmark.URL)
	}
}

func TestParsePreservesIcon(t *testing.T) {
	data, err := os.ReadFile("testdata/simple.html")
	if err != nil {
		t.Fatal(err)
	}

	nodes, err := Parse(data)
	if err != nil {
		t.Fatal(err)
	}

	bm := nodes[0].Folder.Children[0]
	expected := "data:image/png;base64,abc123"
	if bm.Bookmark.Icon != expected {
		t.Errorf("expected icon '%s', got '%s'", expected, bm.Bookmark.Icon)
	}
}

func TestParseTimestamps(t *testing.T) {
	data, err := os.ReadFile("testdata/simple.html")
	if err != nil {
		t.Fatal(err)
	}

	nodes, err := Parse(data)
	if err != nil {
		t.Fatal(err)
	}

	folder := nodes[0].Folder
	if folder.AddDate.Unix() != 1700000000 {
		t.Errorf("expected add_date 1700000000, got %d", folder.AddDate.Unix())
	}

	bm := nodes[0].Folder.Children[0]
	if bm.Bookmark.AddDate.Unix() != 1700000001 {
		t.Errorf("expected add_date 1700000001, got %d", bm.Bookmark.AddDate.Unix())
	}
}
```

**Step 5: Run tests**

Run: `go test ./internal/bookmarks/... -v -run TestParse`

Expected: All parse tests pass.

**Step 6: Commit**

```bash
git add internal/bookmarks/parser.go internal/bookmarks/parser_test.go internal/bookmarks/testdata/
git commit -m "feat: implement Netscape HTML parser with tests"
```

---

## Phase 4: Netscape HTML Serializer

### Task 5: Implement the HTML serializer

**Objective:** Serialize the in-memory Node tree back to Netscape Bookmarks HTML format.

**Files:**
- Create: `internal/bookmarks/serializer.go`
- Create: `internal/bookmarks/serializer_test.go`

**Step 1: Write serializer.go**

The serializer must produce valid Netscape HTML. Key rules:
- Output `<!DOCTYPE NETSCAPE-Bookmark-file-1>` header
- Include `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">`
- Include `<TITLE>Bookmarks</TITLE>` and `<H1>Bookmarks</H1>`
- Wrap everything in `<DL><p> ... </DL><p>`
- Folders: `<DT><H3 ADD_DATE="..." LAST_MODIFIED="...">NAME</H3>` followed by children DL
- Bookmarks: `<DT><A HREF="..." ADD_DATE="..." LAST_MODIFIED="..." ICON="...">TITLE</A>`
- Escape HTML entities in titles and URLs (`<`, `>`, `&`, `"`)
- Only emit ADD_DATE/LAST_MODIFIED if the time is non-zero
- Only emit ICON if non-empty
- Preserve order of children exactly

**Step 2: Write serializer_test.go**

```go
package bookmarks

import (
	"strings"
	"testing"
	"time"
)

func TestSerializeSimple(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:      "f1",
				Name:    "Test Folder",
				AddDate: time.Unix(1700000000, 0),
				Children: []Node{
					{
						Type: TypeBookmark,
						Bookmark: &Bookmark{
							ID:      "b1",
							Title:   "Example",
							URL:     "https://example.com",
							AddDate: time.Unix(1700000001, 0),
						},
					},
				},
			},
		},
	}

	output := Serialize(nodes)

	if !strings.Contains(output, "<!DOCTYPE NETSCAPE-Bookmark-file-1>") {
		t.Error("missing DOCTYPE")
	}
	if !strings.Contains(output, ">Test Folder<") {
		t.Error("missing folder name")
	}
	if !strings.Contains(output, `HREF="https://example.com"`) {
		t.Error("missing bookmark URL")
	}
	if !strings.Contains(output, ">Example<") {
		t.Error("missing bookmark title")
	}
}

func TestSerializeHTMLEscape(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeBookmark,
			Bookmark: &Bookmark{
				ID:    "b1",
				Title: "O'Reilly & Co <Books>",
				URL:   "https://example.com?a=1&b=2",
			},
		},
	}

	output := Serialize(nodes)

	if strings.Contains(output, "<Books>") {
		t.Error("title should be HTML-escaped")
	}
	if !strings.Contains(output, "&amp;") {
		t.Error("ampersand should be escaped")
	}
}

func TestSerializeRoundTrip(t *testing.T) {
	// Parse a file, serialize it, parse again — tree should be equivalent
	inputData := []byte(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Folder</H3>
    <DL><p>
        <DT><A HREF="https://example.com">Example</A>
    </DL><p>
</DL><p>`)

	original, err := Parse(inputData)
	if err != nil {
		t.Fatal(err)
	}

	serialized := Serialize(original)
	roundTrip, err := Parse([]byte(serialized))
	if err != nil {
		t.Fatalf("round-trip parse failed: %v", err)
	}

	if !treesEqual(original, roundTrip) {
		t.Error("round-trip produced different tree")
	}
}

// treesEqual compares two trees by structure, names, URLs, and attributes (ignoring IDs).
func treesEqual(a, b []Node) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Type != b[i].Type {
			return false
		}
		if a[i].Type == TypeFolder {
			if a[i].Folder.Name != b[i].Folder.Name {
				return false
			}
			if !treesEqual(a[i].Folder.Children, b[i].Folder.Children) {
				return false
			}
		} else {
			if a[i].Bookmark.Title != b[i].Bookmark.Title {
				return false
			}
			if a[i].Bookmark.URL != b[i].Bookmark.URL {
				return false
			}
		}
	}
	return true
}
```

**Step 3: Run tests**

Run: `go test ./internal/bookmarks/... -v -run TestSerialize`

Expected: All serializer tests pass, including round-trip.

**Step 4: Commit**

```bash
git add internal/bookmarks/serializer.go internal/bookmarks/serializer_test.go
git commit -m "feat: implement Netscape HTML serializer with round-trip test"
```

---

## Phase 5: CRUD Operations

### Task 6: Implement bookmark and folder CRUD operations

**Objective:** Implement add, update, delete, and move operations on the Node tree.

**Files:**
- Create: `internal/bookmarks/operations.go`
- Create: `internal/bookmarks/operations_test.go`

**Step 1: Write operations.go**

Implement these functions operating on a `[]Node` tree:

```go
package bookmarks

import (
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("node not found")
	ErrCircularMove   = errors.New("cannot move folder into its own descendant")
	ErrInvalidTarget  = errors.New("cannot move into a bookmark (only folders)")
)

// FindNode locates a node by ID anywhere in the tree.
func FindNode(nodes []Node, id string) *Node {
	for i := range nodes {
		if nodes[i].ID() == id {
			return &nodes[i]
		}
		if nodes[i].Type == TypeFolder {
			if found := FindNode(nodes[i].Folder.Children, id); found != nil {
				return found
			}
		}
	}
	return nil
}

// FindParent locates the parent node that contains the given child ID.
func FindParent(nodes []Node, childID string) *Node {
	for i := range nodes {
		if nodes[i].Type == TypeFolder {
			for j := range nodes[i].Folder.Children {
				if nodes[i].Folder.Children[j].ID() == childID {
					return &nodes[i]
				}
			}
			if found := FindParent(nodes[i].Folder.Children, childID); found != nil {
				return found
			}
		}
	}
	return nil
}

// AddBookmark appends a bookmark to a folder.
func AddBookmark(nodes []Node, parentID string, bm Bookmark) ([]Node, error) {
	parent := FindNode(nodes, parentID)
	if parent == nil {
		return nodes, ErrNotFound
	}
	if parent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}
	bm.ID = GenerateID()
	if bm.AddDate.IsZero() {
		bm.AddDate = time.Now()
	}
	bm.LastModified = time.Now()
	parent.Folder.Children = append(parent.Folder.Children, Node{
		Type:     TypeBookmark,
		Bookmark: &bm,
	})
	return nodes, nil
}

// AddFolder creates a new folder inside a parent folder.
func AddFolder(nodes []Node, parentID string, name string) ([]Node, error) {
	parent := FindNode(nodes, parentID)
	if parent == nil {
		return nodes, ErrNotFound
	}
	if parent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}
	folder := &Folder{
		ID:           GenerateID(),
		Name:         name,
		AddDate:      time.Now(),
		LastModified: time.Now(),
		Children:     []Node{},
	}
	parent.Folder.Children = append(parent.Folder.Children, Node{
		Type:   TypeFolder,
		Folder: folder,
	})
	return nodes, nil
}

// UpdateBookmark modifies an existing bookmark's fields.
func UpdateBookmark(nodes []Node, id string, bm Bookmark) error {
	node := FindNode(nodes, id)
	if node == nil {
		return ErrNotFound
	}
	if node.Type != TypeBookmark {
		return errors.New("node is not a bookmark")
	}
	// Update only non-zero/non-empty fields
	if bm.Title != "" {
		node.Bookmark.Title = bm.Title
	}
	if bm.URL != "" {
		node.Bookmark.URL = bm.URL
	}
	if bm.Icon != "" {
		node.Bookmark.Icon = bm.Icon
	}
	if bm.IconURI != "" {
		node.Bookmark.IconURI = bm.IconURI
	}
	if bm.Meta != "" {
		node.Bookmark.Meta = bm.Meta
	}
	node.Bookmark.LastModified = time.Now()
	return nil
}

// UpdateFolderName renames a folder.
func UpdateFolderName(nodes []Node, id string, name string) error {
	node := FindNode(nodes, id)
	if node == nil {
		return ErrNotFound
	}
	if node.Type != TypeFolder {
		return errors.New("node is not a folder")
	}
	node.Folder.Name = name
	node.Folder.LastModified = time.Now()
	return nil
}

// DeleteNode removes a node by ID.
func DeleteNode(nodes []Node, id string) ([]Node, error) {
	parent := FindParent(nodes, id)
	if parent == nil {
		// Might be a root-level node
		return deleteFromSlice(nodes, id), ErrNotFound // handle root case
	}
	children := &parent.Folder.Children
	newChildren := deleteFromSlice(*children, id)
	*children = newChildren
	return nodes, nil
}

// deleteFromSlice removes a node with the given ID from a slice.
func deleteFromSlice(nodes []Node, id string) []Node {
	for i := range nodes {
		if nodes[i].ID() == id {
			return append(nodes[:i], nodes[i+1:]...)
		}
		if nodes[i].Type == TypeFolder {
			nodes[i].Folder.Children = deleteFromSlice(nodes[i].Folder.Children, id)
		}
	}
	return nodes
}

// IsDescendant checks if ancestor is an ancestor of descendant.
func IsDescendant(nodes []Node, ancestorID, descendantID string) bool {
	ancestor := FindNode(nodes, ancestorID)
	if ancestor == nil {
		return false
	}
	if ancestor.Type != TypeFolder {
		return false
	}
	return isDescendantInChildren(ancestor.Folder.Children, descendantID)
}

func isDescendantInChildren(children []Node, targetID string) bool {
	for i := range children {
		if children[i].ID() == targetID {
			return true
		}
		if children[i].Type == TypeFolder {
			if isDescendantInChildren(children[i].Folder.Children, targetID) {
				return true
			}
		}
	}
	return false
}

// MoveNode moves a node to a new parent at a specific index.
func MoveNode(nodes []Node, nodeID, newParentID string, newIndex int) ([]Node, error) {
	// Cannot move into self
	if nodeID == newParentID {
		return nodes, ErrCircularMove
	}
	// Cannot move folder into its own descendant
	node := FindNode(nodes, nodeID)
	if node == nil {
		return nodes, ErrNotFound
	}
	if node.Type == TypeFolder && IsDescendant(nodes, nodeID, newParentID) {
		return nodes, ErrCircularMove
	}

	// Find and remove from current parent
	parent := FindParent(nodes, nodeID)
	var removed Node
	if parent == nil {
		// Root-level node
		removed = *FindNode(nodes, nodeID)
		nodes = deleteFromSlice(nodes, nodeID)
	} else {
		children := &parent.Folder.Children
		for i := range *children {
			if (*children)[i].ID() == nodeID {
				removed = (*children)[i]
				*children = append((*children)[:i], (*children)[i+1:]...)
				break
			}
		}
	}

	// Insert into new parent at index
	newParent := FindNode(nodes, newParentID)
	if newParent == nil {
		return nodes, ErrNotFound
	}
	if newParent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}

	children := newParent.Folder.Children
	if newIndex < 0 || newIndex > len(children) {
		newIndex = len(children)
	}
	children = append(children, Node{})
	copy(children[newIndex+1:], children[newIndex:])
	children[newIndex] = removed

	return nodes, nil
}

// BuildFlatIndex creates a flat list of all bookmarks with their folder paths for search.
func BuildFlatIndex(nodes []Node) []BookmarkIndexEntry {
	return buildFlatIndexRecursive(nodes, "")
}

type BookmarkIndexEntry struct {
	NodeID    string
	Title     string
	URL       string
	FolderPath string
}

func buildFlatIndexRecursive(nodes []Node, path string) []BookmarkIndexEntry {
	var result []BookmarkIndexEntry
	for i := range nodes {
		if nodes[i].Type == TypeBookmark {
			result = append(result, BookmarkIndexEntry{
				NodeID:     nodes[i].ID(),
				Title:      nodes[i].Bookmark.Title,
				URL:        nodes[i].Bookmark.URL,
				FolderPath: path,
			})
		} else {
			newPath := path
			if newPath == "" {
				newPath = nodes[i].Folder.Name
			} else {
				newPath = path + " / " + nodes[i].Folder.Name
			}
			result = append(result, buildFlatIndexRecursive(nodes[i].Folder.Children, newPath)...)
		}
	}
	return result
}
```

**Step 2: Write operations_test.go**

Test: AddBookmark, AddFolder, UpdateBookmark, UpdateFolderName, DeleteNode, MoveNode (including circular move prevention), BuildFlatIndex.

**Step 3: Run tests**

Run: `go test ./internal/bookmarks/... -v -run TestOp`

Expected: All operation tests pass.

**Step 4: Commit**

```bash
git add internal/bookmarks/operations.go internal/bookmarks/operations_test.go
git commit -m "feat: implement CRUD operations (add, update, delete, move, flat index)"
```

---

## Phase 6: Wails API Handler

### Task 7: Create the Wails API handler

**Objective:** Expose the bookmark operations through Wails bindings to the frontend.

**Files:**
- Create: `internal/wailsapi/handler.go`
- Modify: `main.go`

**Step 1: Write handler.go**

```go
package wailsapi

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
	"golang.org/x/net/html"
)

type Handler struct {
	filePath string
	tree     []bookmarks.Node
}

// NewHandler creates a new API handler.
func NewHandler() *Handler {
	return &Handler{}
}

// LoadFile loads a Netscape bookmark HTML file and parses it into the tree.
func (h *Handler) LoadFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	tree, err := bookmarks.Parse(data)
	if err != nil {
		return fmt.Errorf("failed to parse bookmarks: %w", err)
	}

	h.filePath = path
	h.tree = tree
	return nil
}

// GetTree returns the current bookmark tree.
func (h *Handler) GetTree() []bookmarks.Node {
	return h.tree
}

// GetFlatIndex returns a flat index of all bookmarks for search.
func (h *Handler) GetFlatIndex() []bookmarks.BookmarkIndexEntry {
	return bookmarks.BuildFlatIndex(h.tree)
}

// GetRootFolders returns the IDs of root-level folders for the "move to" dialog.
func (h *Handler) GetRootFolders() []bookmarks.Node {
	return h.tree
}

// GetAllFolders returns all folder nodes in the tree (for move target selection).
func (h *Handler) GetAllFolders() []bookmarks.Node {
	return collectFolders(h.tree)
}

func collectFolders(nodes []bookmarks.Node) []bookmarks.Node {
	var folders []bookmarks.Node
	for i := range nodes {
		if nodes[i].Type == bookmarks.TypeFolder {
			folders = append(folders, nodes[i])
			folders = append(folders, collectFolders(nodes[i].Folder.Children)...)
		}
	}
	return folders
}

// AddBookmark adds a bookmark to a folder and auto-saves.
func (h *Handler) AddBookmark(parentID string, bm bookmarks.Bookmark) (string, error) {
	var err error
	h.tree, err = bookmarks.AddBookmark(h.tree, parentID, bm)
	if err != nil {
		return "", err
	}
	h.save()
	return bm.ID, nil
}

// AddFolder adds a folder and auto-saves.
func (h *Handler) AddFolder(parentID string, name string) (string, error) {
	var err error
	h.tree, err = bookmarks.AddFolder(h.tree, parentID, name)
	if err != nil {
		return "", err
	}
	h.save()
	return "", nil // ID is generated inside AddFolder
}

// UpdateBookmark updates a bookmark and auto-saves.
func (h *Handler) UpdateBookmark(id string, bm bookmarks.Bookmark) error {
	err := bookmarks.UpdateBookmark(h.tree, id, bm)
	if err != nil {
		return err
	}
	h.save()
	return nil
}

// UpdateFolderName renames a folder and auto-saves.
func (h *Handler) UpdateFolderName(id string, name string) error {
	err := bookmarks.UpdateFolderName(h.tree, id, name)
	if err != nil {
		return err
	}
	h.save()
	return nil
}

// DeleteNode deletes a node and auto-saves.
func (h *Handler) DeleteNode(id string) error {
	var err error
	h.tree, err = bookmarks.DeleteNode(h.tree, id)
	if err != nil {
		return err
	}
	h.save()
	return nil
}

// MoveNode moves a node and auto-saves.
func (h *Handler) MoveNode(nodeID, newParentID string, newIndex int) error {
	var err error
	h.tree, err = bookmarks.MoveNode(h.tree, nodeID, newParentID, newIndex)
	if err != nil {
		return err
	}
	h.save()
	return nil
}

// FetchPageTitle fetches the <title> from a URL.
func (h *Handler) FetchPageTitle(pageURL string) (string, error) {
	client := &http.Client{
		Timeout: 3 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // don't follow redirects, get the title page
		},
	}

	resp, err := client.Get(pageURL)
	if err != nil {
		return "", fmt.Errorf("failed to fetch page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	doc, err := html.Parse(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to parse HTML: %w", err)
	}

	title := extractTitle(doc)
	return title, nil
}

func extractTitle(n *html.Node) string {
	if n.Type == html.ElementNode && n.Data == "title" {
		if n.FirstChild != nil {
			return n.FirstChild.Data
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if t := extractTitle(c); t != "" {
			return t
		}
	}
	return ""
}

// FetchFavicon fetches a favicon for a URL using Google's favicon service.
func (h *Handler) FetchFavicon(pageURL string) (string, error) {
	u, err := url.Parse(pageURL)
	if err != nil {
		return "", fmt.Errorf("invalid URL: %w", err)
	}

	faviconURL := fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s&sz=32", u.Host)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(faviconURL)
	if err != nil {
		return "", fmt.Errorf("failed to fetch favicon: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read favicon: %w", err)
	}

	// Determine content type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/png"
	}

	return fmt.Sprintf("data:%s;base64,%s", contentType, encodeBase64(data)), nil
}

func encodeBase64(data []byte) string {
	// Use encoding/base64
	import "encoding/base64"
	return base64.StdEncoding.EncodeToString(data)
}

// OpenURL opens a URL in the default browser.
func (h *Handler) OpenURL(pageURL string) error {
	var cmd string
	args := []string{pageURL}

	switch runtime.GOOS {
	case "linux":
		cmd = "xdg-open"
	case "darwin":
		cmd = "open"
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start", ""}
		args = append(args, pageURL)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	_, err := exec.Command(cmd, args...).Output()
	return err
}

// save writes the current tree back to the HTML file.
func (h *Handler) save() error {
	if h.filePath == "" {
		return nil
	}
	output := bookmarks.Serialize(h.tree)
	return os.WriteFile(h.filePath, []byte(output), 0644)
}

// FilePath returns the currently loaded file path.
func (h *Handler) FilePath() string {
	return h.filePath
}
```

**Step 2: Update main.go to bind the handler**

Modify `main.go` to:
1. Create the handler with `wailsapi.NewHandler()`
2. Bind it with `wails.Bind(app, handler)`
3. Pass the file path from CLI args to `handler.LoadFile()`
4. Handle the case where no file path is provided (show file picker — can be a Wails dialog)

**Step 3: Verify compilation**

Run: `go build ./...`

Expected: Compiles without errors.

**Step 4: Commit**

```bash
git add internal/wailsapi/handler.go main.go
git commit -m "feat: implement Wails API handler with CRUD, title fetch, favicon, open URL"
```

---

## Phase 7: Frontend — API Wrapper and Stores

### Task 8: Create the Wails API wrapper

**Objective:** Create a JavaScript wrapper around Wails Go bindings.

**Files:**
- Create: `frontend/src/lib/api.js`

**Step 1: Write api.js**

```js
import { go } from '../../wailsjs/go/*';

// Re-export the Wails-generated bindings with cleaner names.
// The actual import path depends on Wails v2 codegen.
// Wails v2 generates bindings at frontend/wailsjs/go/main/App.js
// and frontend/wailsjs/go/models/

export * from '../../wailsjs/go/main/App.js';
export * from '../../wailsjs/go/models/models.Bookmark.js';
export * from '../../wailsjs/go/models/models.Folder.js';
export * from '../../wailsjs/go/models/models.Node.js';
```

Note: After running `wails generate`, the actual model paths will be auto-generated. Adjust imports accordingly.

**Step 2: Commit**

```bash
git add frontend/src/lib/api.js
git commit -m "feat: create Wails API wrapper for Go bindings"
```

---

### Task 9: Create the tree store

**Objective:** Manage the bookmark tree state in a Svelte 5 store.

**Files:**
- Create: `frontend/src/lib/stores/treeStore.js`

**Step 1: Write treeStore.js**

```js
import { go } from '../../wailsjs/go/main/App.js';

export function createTreeStore() {
  let tree = $state([]);
  let selectedNodeId = $state('');
  let expandedNodeIds = $state(new Set());
  let loading = $state(false);
  let error = $state('');

  const handler = new go.Main.App(); // or wherever Wails binds the handler

  async function loadFile(path) {
    loading = true;
    error = '';
    try {
      await handler.LoadFile(path);
      tree = await handler.GetTree();
      // Expand root folders by default
      tree.forEach(node => {
        if (node.type === 0) { // TypeFolder
          expandedNodeIds.add(node.id);
        }
      });
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function selectNode(id) {
    selectedNodeId = id;
  }

  function toggleExpand(id) {
    if (expandedNodeIds.has(id)) {
      expandedNodeIds.delete(id);
    } else {
      expandedNodeIds.add(id);
    }
  }

  function isExpanded(id) {
    return expandedNodeIds.has(id);
  }

  function getNode(id) {
    return findNode(tree, id);
  }

  function findNode(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.type === 0 && node.folder) { // TypeFolder
        const found = findNode(node.folder.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  return {
    get tree() { return tree; },
    get selectedNodeId() { return selectedNodeId; },
    get loading() { return loading; },
    get error() { return error; },
    loadFile,
    selectNode,
    toggleExpand,
    isExpanded,
    getNode,
  };
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.folder && node.folder.children) {
      const found = findNode(node.folder.children, id);
      if (found) return found;
    }
  }
  return null;
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/stores/treeStore.js
git commit -m "feat: create tree store with selection and expand/collapse state"
```

---

### Task 10: Create the search store

**Objective:** Manage search state with a flat index and derived filtered results.

**Files:**
- Create: `frontend/src/lib/stores/searchStore.js`

**Step 1: Write searchStore.js**

```js
export function createSearchStore() {
  let query = $state('');
  let flatIndex = $state([]);

  // Derived: filtered results based on query
  $derived.by(() => {
    // This runs reactively when query or flatIndex changes
  });

  function setQuery(q) {
    query = q;
  }

  function setIndex(index) {
    flatIndex = index;
  }

  function getResults() {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return flatIndex.filter(entry =>
      entry.title.toLowerCase().includes(q) ||
      entry.url.toLowerCase().includes(q)
    );
  }

  return {
    get query() { return query; },
    setQuery,
    setIndex,
    getResults,
  };
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/stores/searchStore.js
git commit -m "feat: create search store with flat index and derived filtering"
```

---

### Task 11: Create the UI store

**Objective:** Manage modal and toast state.

**Files:**
- Create: `frontend/src/lib/stores/uiStore.js`

**Step 1: Write uiStore.js**

```js
export function createUIStore() {
  let toasts = $state([]);
  let modal = $state({ open: false, title: '', message: '', confirmLabel: 'OK', onConfirm: null });

  function showToast(message, type = 'info', duration = 4000) {
    const id = Date.now();
    toasts.push({ id, message, type });
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
    }, duration);
  }

  function showConfirm(title, message, confirmLabel = 'OK', onConfirm = null) {
    modal = { open: true, title, message, confirmLabel, onConfirm };
  }

  function closeModal() {
    modal = { open: false, title: '', message: '', confirmLabel: 'OK', onConfirm: null };
  }

  function confirmModal() {
    if (modal.onConfirm) modal.onConfirm();
    closeModal();
  }

  return {
    get toasts() { return toasts; },
    get modal() { return modal; },
    showToast,
    showConfirm,
    closeModal,
    confirmModal,
  };
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/stores/uiStore.js
git commit -m "feat: create UI store for modals and toasts"
```

---

## Phase 8: Frontend Components

### Task 12: Create the SearchBar component

**Objective:** Search input bar at the top of the app.

**Files:**
- Create: `frontend/src/lib/components/SearchBar.svelte`

**Step 1: Write SearchBar.svelte**

```svelte
<script>
  import { createSearchStore } from '../stores/searchStore.js';
  const searchStore = createSearchStore();

  let inputRef;

  $effect(() => {
    inputRef?.focus();
  });
</script>

<div class="flex items-center gap-2 px-4 py-2 bg-base-100 border-b border-base-300">
  <input
    bind:this={inputRef}
    type="text"
    placeholder="Search bookmarks..."
    class="input input-bordered input-sm flex-1 max-w-md"
    on:keydown={(e) => {
      searchStore.setQuery(e.currentTarget.value);
    }}
  />
  {#if searchStore.query}
    <button class="btn btn-ghost btn-sm" on:click={() => searchStore.setQuery('')}>
      Clear
    </button>
  {/if}
</div>
```

**Step 2: Commit**

```bash
git add frontend/src/lib/components/SearchBar.svelte
git commit -m "feat: create SearchBar component with reactive filtering"
```

---

### Task 13: Create the BookmarkTree component

**Objective:** Recursive tree view showing folders and bookmarks with expand/collapse, selection, and drag-and-drop.

**Files:**
- Create: `frontend/src/lib/components/BookmarkTree.svelte`

**Step 1: Write BookmarkTree.svelte**

This is the most complex component. It renders a recursive tree:

- Each folder row has a chevron icon that toggles expand/collapse
- Each row is clickable to select
- Bookmarks show a bookmark icon, folders show a folder icon
- Drag-and-drop: each node is draggable, folders are drop targets
- When search is active, only show matching results

Key Svelte 5 patterns:
- Use `$state` for drag state
- Recursive self-inclusion for nested folders
- DaisyUI `tree-view` or custom styled `ul/li` structure

The component receives `nodes` (array of Node), `depth` (indentation level), and uses the treeStore for selection/expand state.

**Step 2: Commit**

```bash
git add frontend/src/lib/components/BookmarkTree.svelte
git commit -m "feat: create BookmarkTree component with expand/collapse and selection"
```

---

### Task 14: Create the DetailPanel component

**Objective:** Right pane showing folder or bookmark details with editing capabilities.

**Files:**
- Create: `frontend/src/lib/components/DetailPanel.svelte`

**Step 1: Write DetailPanel.svelte**

When a folder is selected:
- Display folder name (editable inline)
- Show child count
- "Add Bookmark" button (opens inline form)
- "Add Folder" button (opens inline form)

When a bookmark is selected:
- Title input (editable)
- URL input (editable, triggers title auto-fetch on change with debounce)
- Icon preview with "Fetch Favicon" button
- Add Date / Last Modified display
- Notes/Meta textarea
- "Open in Browser" button
- "Move To..." button
- "Delete" button (triggers confirmation modal)

**Step 2: Commit**

```bash
git add frontend/src/lib/components/DetailPanel.svelte
git commit -m "feat: create DetailPanel with bookmark and folder editing"
```

---

### Task 15: Create the AddBookmark and AddFolder inline forms

**Objective:** Small inline forms for adding new bookmarks and folders.

**Files:**
- Create: `frontend/src/lib/components/AddBookmarkForm.svelte`
- Create: `frontend/src/lib/components/AddFolderForm.svelte`

**Step 1: Write AddBookmarkForm.svelte**

Simple form with URL input (with title auto-fetch debounce) and optional title override. Submit calls the Wails API.

**Step 2: Write AddFolderForm.svelte**

Simple form with folder name input. Submit calls the Wails API.

**Step 3: Commit**

```bash
git add frontend/src/lib/components/AddBookmarkForm.svelte frontend/src/lib/components/AddFolderForm.svelte
git commit -m "feat: create AddBookmarkForm and AddFolderForm components"
```

---

### Task 16: Create the MoveDialog component

**Objective:** Modal dialog for selecting a target folder when moving a bookmark or folder.

**Files:**
- Create: `frontend/src/lib/components/MoveDialog.svelte`

**Step 1: Write MoveDialog.svelte**

DaisyUI modal containing a tree of all folders. User selects the target folder and confirms. Calls `MoveNode` on the Wails handler.

**Step 2: Commit**

```bash
git add frontend/src/lib/components/MoveDialog.svelte
git commit -m "feat: create MoveDialog component with folder selection tree"
```

---

### Task 17: Create the Toast and Modal components

**Objective:** Reusable toast notification and confirmation modal components.

**Files:**
- Create: `frontend/src/lib/components/ToastContainer.svelte`
- Create: `frontend/src/lib/components/ConfirmModal.svelte`

**Step 1: Write ToastContainer.svelte**

Renders all toasts from uiStore. Each toast auto-dismisses after the configured duration. Uses DaisyUI `toast` component with color variants (info, success, error, warning).

**Step 2: Write ConfirmModal.svelte**

Renders the confirmation modal from uiStore. Shows title, message, Cancel and Confirm buttons. Uses DaisyUI `modal` component.

**Step 3: Commit**

```bash
git add frontend/src/lib/components/ToastContainer.svelte frontend/src/lib/components/ConfirmModal.svelte
git commit -m "feat: create ToastContainer and ConfirmModal components"
```

---

### Task 18: Wire up App.svelte with the complete layout

**Objective:** Assemble all components into the final two-pane layout.

**Files:**
- Modify: `frontend/src/App.svelte`

**Step 1: Rewrite App.svelte**

```svelte
<script>
  import { createTreeStore } from './lib/stores/treeStore.js';
  import { createSearchStore } from './lib/stores/searchStore.js';
  import { createUIStore } from './lib/stores/uiStore.js';
  import SearchBar from './lib/components/SearchBar.svelte';
  import BookmarkTree from './lib/components/BookmarkTree.svelte';
  import DetailPanel from './lib/components/DetailPanel.svelte';
  import ToastContainer from './lib/components/ToastContainer.svelte';
  import ConfirmModal from './lib/components/ConfirmModal.svelte';

  const treeStore = createTreeStore();
  const searchStore = createSearchStore();
  const uiStore = createUIStore();

  // On mount, check for file path or show file picker
  $effect(() => {
    // Load file logic — handled by main.go passing the path
    // or triggering a Wails file picker dialog
  });
</script>

<div class="h-screen flex flex-col bg-base-200">
  <!-- Top bar -->
  <div class="navbar bg-base-100 shadow-sm px-4">
    <div class="flex-1">
      <h1 class="text-lg font-bold text-primary">justbookmarks</h1>
    </div>
    <div class="flex-none">
      {#if treeStore.loading}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
    </div>
  </div>

  <!-- Search -->
  <SearchBar />

  <!-- Main content -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left pane: Tree -->
    <div class="w-1/2 min-w-[300px] border-r border-base-300 overflow-y-auto bg-base-100">
      <BookmarkTree {treeStore} {searchStore} />
    </div>

    <!-- Right pane: Detail -->
    <div class="flex-1 overflow-y-auto bg-base-100 p-4">
      <DetailPanel {treeStore} {uiStore} />
    </div>
  </div>

  <!-- Global UI overlays -->
  <ToastContainer {uiStore} />
  <ConfirmModal {uiStore} />
</div>
```

**Step 2: Commit**

```bash
git add frontend/src/App.svelte
git commit -m "feat: wire up complete two-pane layout in App.svelte"
```

---

## Phase 9: File Picker on Startup

### Task 19: Implement file picker dialog when no file path provided

**Objective:** Show a native file picker dialog if the app is launched without a file argument.

**Files:**
- Modify: `main.go`
- Modify: `frontend/src/App.svelte`

**Step 1: Update main.go**

Use Wails' `dialog.Open()` if no CLI arg is provided:

```go
// In OnStartup or via a bound method:
func (a *App) OpenFilePicker() string {
    file, err := a.ctx.(wails.Runtime).Dialog().Openfile(wails.OpenFileOptions{})
    if err != nil {
        return ""
    }
    return file
}
```

**Step 2: Update App.svelte**

On mount, check if a file was loaded. If not, trigger the file picker via Wails binding.

**Step 3: Commit**

```bash
git add main.go frontend/src/App.svelte
git commit -m "feat: add file picker dialog for startup without CLI arg"
```

---

## Phase 10: Drag-and-Drop

### Task 20: Implement drag-and-drop in the tree

**Objective:** Enable drag-and-drop reordering and moving of bookmarks and folders within the tree.

**Files:**
- Modify: `frontend/src/lib/components/BookmarkTree.svelte`

**Step 1: Add HTML5 Drag and Drop to BookmarkTree**

- Make each tree row `draggable="true"`
- Handle `dragstart` — store the dragged node ID in a data transfer
- Handle `dragover` on folder rows — highlight as drop target
- Handle `drop` — call `MoveNode` with the target folder ID and calculated index
- Prevent dropping a folder into its own descendant (validate in Go, show toast on error)

**Step 2: Add visual feedback**

- Dragged item gets opacity reduction
- Drop target folder gets a highlighted background
- Insertion indicator line shows where the item will be placed

**Step 3: Commit**

```bash
git add frontend/src/lib/components/BookmarkTree.svelte
git commit -m "feat: implement drag-and-drop reordering and moving in tree"
```

---

## Phase 11: Title Auto-Fetch

### Task 21: Implement title auto-fetch with debounce in the bookmark form

**Objective:** Auto-fetch page title when URL changes in the add/edit form.

**Files:**
- Modify: `frontend/src/lib/components/AddBookmarkForm.svelte`
- Modify: `frontend/src/lib/components/DetailPanel.svelte`

**Step 1: Add debounced title fetch**

In both forms, add a `$effect` that watches the URL field. On change, start a 800ms timer. If the URL changes again before the timer fires, reset it. When the timer fires, call `handler.FetchPageTitle(url)` and fill the title field.

Show a small spinner next to the URL input while fetching.

**Step 2: Commit**

```bash
git add frontend/src/lib/components/AddBookmarkForm.svelte frontend/src/lib/components/DetailPanel.svelte
git commit -m "feat: add debounced title auto-fetch on URL change"
```

---

## Phase 12: Polish and Final Testing

### Task 22: Add application icon and build configuration

**Objective:** Set up proper app icon and Wails build configuration.

**Files:**
- Replace: `build/appicon.png` (with a real icon)
- Create: `build/windows/info.json`
- Create: `build/darwin/Info.plist`

**Step 1: Create build metadata files**

Configure app name, description, and icon for each platform.

**Step 2: Test build**

Run: `wails build -platform linux/amd64`

Expected: Produces a working Linux binary.

**Step 3: Commit**

```bash
git add build/
git commit -m "chore: add build configuration and app icon"
```

---

### Task 23: Run full test suite and fix issues

**Objective:** Run all Go tests, fix any failures, verify the app end-to-end.

**Step 1: Run Go tests**

Run: `go test ./... -v -cover`

Expected: All tests pass, reasonable coverage on the bookmarks package.

**Step 2: Manual end-to-end test**

1. Launch with `wails dev`
2. Open a test bookmark HTML file
3. Verify tree renders correctly
4. Add a bookmark — verify it appears and is saved
5. Edit a bookmark title — verify it updates and saves
6. Delete a bookmark — verify it's removed
7. Move a bookmark via drag-and-drop — verify new position
8. Search for a bookmark — verify filtering works
9. Fetch favicon — verify icon appears
10. Open bookmark in browser — verify browser opens

**Step 3: Commit**

```bash
git add .
git commit -m "fix: resolve test failures and polish before v1 release"
```

---

### Task 24: Update README.md

**Objective:** Write a proper README with installation, usage, and build instructions.

**Files:**
- Modify: `README.md`

**Step 1: Write README**

Include:
- Project description
- Screenshot placeholder
- Installation (download from releases)
- Usage (CLI arg or file picker)
- Building from source (`wails dev`, `wails build`)
- Supported platforms
- License

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: write README with installation and usage instructions"
```

---

## Summary

| Phase | Tasks | Description |
|---|---|---|
| 1 | 1-2 | Project scaffolding (Wails + Svelte) |
| 2 | 3 | Go data model |
| 3 | 4 | Netscape HTML parser |
| 4 | 5 | Netscape HTML serializer |
| 5 | 6 | CRUD operations |
| 6 | 7 | Wails API handler |
| 7 | 8-11 | Frontend stores and API wrapper |
| 8 | 12-18 | Frontend components |
| 9 | 19 | File picker on startup |
| 10 | 20 | Drag-and-drop |
| 11 | 21 | Title auto-fetch |
| 12 | 22-24 | Polish, testing, README |

**Total: 24 tasks across 12 phases.**

Plan complete and saved. Ready to execute using subagent-driven-development — I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
