package bookmarks

import (
	"testing"
)

// --- helpers ---

func buildTestTree() []Node {
	return []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:   "f-root",
				Name: "Root",
				Children: []Node{
					{
						Type: TypeFolder,
						Folder: &Folder{
							ID:   "f-sub",
							Name: "Sub",
							Children: []Node{
								{
									Type: TypeBookmark,
									Bookmark: &Bookmark{
										ID:    "b-nested",
										Title: "Nested Bookmark",
										URL:   "https://nested.example.com",
									},
								},
							},
						},
					},
					{
						Type: TypeBookmark,
						Bookmark: &Bookmark{
							ID:    "b-root1",
							Title: "Root Bookmark 1",
							URL:   "https://root1.example.com",
						},
					},
					{
						Type: TypeBookmark,
						Bookmark: &Bookmark{
							ID:    "b-root2",
							Title: "Root Bookmark 2",
							URL:   "https://root2.example.com",
						},
					},
				},
			},
		},
	}
}

func buildMultiRootTestTree() []Node {
	nodes := buildTestTree()
	return append(nodes, Node{
		Type: TypeBookmark,
		Bookmark: &Bookmark{
			ID:    "b-top",
			Title: "Top Level Bookmark",
			URL:   "https://top.example.com",
		},
	})
}

// --- FindNode tests ---

func TestFindNode(t *testing.T) {
	nodes := buildTestTree()

	// Find root folder
	n := FindNode(nodes, "f-root")
	if n == nil || n.Folder.Name != "Root" {
		t.Error("should find root folder")
	}

	// Find sub folder
	n = FindNode(nodes, "f-sub")
	if n == nil || n.Folder.Name != "Sub" {
		t.Error("should find sub folder")
	}

	// Find root-level bookmark
	n = FindNode(nodes, "b-root1")
	if n == nil || n.Bookmark.Title != "Root Bookmark 1" {
		t.Error("should find root bookmark")
	}

	// Find nested bookmark
	n = FindNode(nodes, "b-nested")
	if n == nil || n.Bookmark.Title != "Nested Bookmark" {
		t.Error("should find nested bookmark")
	}

	// Find nonexistent
	n = FindNode(nodes, "nonexistent")
	if n != nil {
		t.Error("should return nil for nonexistent node")
	}
}

func TestFindParent(t *testing.T) {
	nodes := buildTestTree()

	// Parent of sub folder is root
	p := FindParent(nodes, "f-sub")
	if p == nil || p.Folder.ID != "f-root" {
		t.Error("parent of f-sub should be f-root")
	}

	// Parent of nested bookmark is sub folder
	p = FindParent(nodes, "b-nested")
	if p == nil || p.Folder.ID != "f-sub" {
		t.Error("parent of b-nested should be f-sub")
	}

	// Parent of root bookmark is root folder
	p = FindParent(nodes, "b-root1")
	if p == nil || p.Folder.ID != "f-root" {
		t.Error("parent of b-root1 should be f-root")
	}

	// Parent of root folder is nil (it's at the top level)
	p = FindParent(nodes, "f-root")
	if p != nil {
		t.Error("root folder should have no parent")
	}
}

// --- AddBookmark tests ---

func TestAddBookmark(t *testing.T) {
	nodes := buildTestTree()

	_, err := AddBookmark(nodes, "f-root", Bookmark{
		Title: "New Bookmark",
		URL:   "https://new.example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	root := nodes[0].Folder
	if len(root.Children) != 4 {
		t.Fatalf("expected 4 children, got %d", len(root.Children))
	}

	last := root.Children[len(root.Children)-1]
	if last.Type != TypeBookmark {
		t.Fatal("last child should be a bookmark")
	}
	if last.Bookmark.Title != "New Bookmark" {
		t.Errorf("expected 'New Bookmark', got '%s'", last.Bookmark.Title)
	}
	if last.Bookmark.URL != "https://new.example.com" {
		t.Errorf("expected correct URL, got '%s'", last.Bookmark.URL)
	}
	if last.Bookmark.ID == "" {
		t.Error("bookmark should have a generated ID")
	}
}

func TestAddRootBookmark(t *testing.T) {
	nodes := buildTestTree()

	updated, err := AddBookmark(nodes, "", Bookmark{
		Title: "Top Level Bookmark",
		URL:   "https://top-level.example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(updated) != len(nodes)+1 {
		t.Fatalf("expected %d root nodes, got %d", len(nodes)+1, len(updated))
	}

	last := updated[len(updated)-1]
	if last.Type != TypeBookmark {
		t.Fatal("last root node should be a bookmark")
	}
	if last.Bookmark.Title != "Top Level Bookmark" {
		t.Errorf("expected 'Top Level Bookmark', got '%s'", last.Bookmark.Title)
	}
	if last.Bookmark.URL != "https://top-level.example.com" {
		t.Errorf("expected correct URL, got '%s'", last.Bookmark.URL)
	}
	if last.Bookmark.ID == "" {
		t.Error("root bookmark should have a generated ID")
	}
}

func TestAddBookmarkNotFound(t *testing.T) {
	nodes := buildTestTree()
	_, err := AddBookmark(nodes, "nonexistent", Bookmark{Title: "X", URL: "https://x.com"})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestAddBookmarkToBookmark(t *testing.T) {
	nodes := buildTestTree()
	_, err := AddBookmark(nodes, "b-root1", Bookmark{Title: "X", URL: "https://x.com"})
	if err != ErrInvalidTarget {
		t.Errorf("expected ErrInvalidTarget, got %v", err)
	}
}

// --- AddFolder tests ---

func TestAddFolder(t *testing.T) {
	nodes := buildTestTree()

	_, err := AddFolder(nodes, "f-root", "New Folder")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	root := nodes[0].Folder
	last := root.Children[len(root.Children)-1]
	if last.Type != TypeFolder {
		t.Fatal("last child should be a folder")
	}
	if last.Folder.Name != "New Folder" {
		t.Errorf("expected 'New Folder', got '%s'", last.Folder.Name)
	}
	if len(last.Folder.Children) != 0 {
		t.Error("new folder should have no children")
	}
}

func TestAddRootFolder(t *testing.T) {
	nodes := buildTestTree()

	updated, err := AddFolder(nodes, "", "Top Level Folder")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(updated) != len(nodes)+1 {
		t.Fatalf("expected %d root nodes, got %d", len(nodes)+1, len(updated))
	}

	last := updated[len(updated)-1]
	if last.Type != TypeFolder {
		t.Fatal("last root node should be a folder")
	}
	if last.Folder.Name != "Top Level Folder" {
		t.Errorf("expected 'Top Level Folder', got '%s'", last.Folder.Name)
	}
	if len(last.Folder.Children) != 0 {
		t.Error("new root folder should have no children")
	}
}

func TestAddFolderNotFound(t *testing.T) {
	nodes := buildTestTree()
	_, err := AddFolder(nodes, "nonexistent", "X")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- UpdateBookmark tests ---

func TestUpdateBookmark(t *testing.T) {
	nodes := buildTestTree()

	title := "Updated Title"
	url := "https://updated.example.com"
	err := UpdateBookmark(nodes, "b-root1", BookmarkPatch{
		Title: &title,
		URL:   &url,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	bm := FindNode(nodes, "b-root1").Bookmark
	if bm.Title != "Updated Title" {
		t.Errorf("expected 'Updated Title', got '%s'", bm.Title)
	}
	if bm.URL != "https://updated.example.com" {
		t.Errorf("expected updated URL, got '%s'", bm.URL)
	}
}

func TestUpdateBookmarkNotFound(t *testing.T) {
	nodes := buildTestTree()
	title := "X"
	err := UpdateBookmark(nodes, "nonexistent", BookmarkPatch{Title: &title})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateBookmarkOnFolder(t *testing.T) {
	nodes := buildTestTree()
	title := "X"
	err := UpdateBookmark(nodes, "f-root", BookmarkPatch{Title: &title})
	if err == nil {
		t.Error("expected error when updating a folder as a bookmark")
	}
}

func TestUpdateBookmarkAllowsClearingFields(t *testing.T) {
	nodes := buildTestTree()

	empty := ""
	err := UpdateBookmark(nodes, "b-root1", BookmarkPatch{
		Title: &empty,
		Meta:  &empty,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	bm := FindNode(nodes, "b-root1").Bookmark
	if bm.Title != "" {
		t.Errorf("expected title to be cleared, got %q", bm.Title)
	}
	if bm.Meta != "" {
		t.Errorf("expected meta to be cleared, got %q", bm.Meta)
	}
}

// --- UpdateFolderName tests ---

func TestUpdateFolderName(t *testing.T) {
	nodes := buildTestTree()

	err := UpdateFolderName(nodes, "f-root", "Renamed Root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if nodes[0].Folder.Name != "Renamed Root" {
		t.Errorf("expected 'Renamed Root', got '%s'", nodes[0].Folder.Name)
	}
}

func TestUpdateFolderNameNotFound(t *testing.T) {
	nodes := buildTestTree()
	err := UpdateFolderName(nodes, "nonexistent", "X")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- DeleteNode tests ---

func TestDeleteBookmark(t *testing.T) {
	nodes := buildTestTree()

	_, err := DeleteNode(nodes, "b-root1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	root := nodes[0].Folder
	if len(root.Children) != 2 {
		t.Errorf("expected 2 children after delete, got %d", len(root.Children))
	}

	// Verify the deleted bookmark is gone
	deleted := FindNode(nodes, "b-root1")
	if deleted != nil {
		t.Error("deleted bookmark should not be found")
	}

	// Verify other nodes remain
	if FindNode(nodes, "b-root2") == nil {
		t.Error("b-root2 should still exist")
	}
}

func TestDeleteFolder(t *testing.T) {
	nodes := buildTestTree()

	_, err := DeleteNode(nodes, "f-sub")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Both the folder and its nested bookmark should be gone
	if FindNode(nodes, "f-sub") != nil {
		t.Error("deleted folder should not be found")
	}
	if FindNode(nodes, "b-nested") != nil {
		t.Error("nested bookmark should also be deleted")
	}
}

func TestDeleteRootLevelNode(t *testing.T) {
	nodes := buildTestTree()

	nodes, err := DeleteNode(nodes, "f-root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(nodes) != 0 {
		t.Errorf("expected 0 root nodes, got %d", len(nodes))
	}
}

func TestDeleteNotFound(t *testing.T) {
	nodes := buildTestTree()
	_, err := DeleteNode(nodes, "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestDeleteNodesRemovesSiblingBookmarks(t *testing.T) {
	nodes := buildTestTree()

	_, err := DeleteNodes(nodes, []string{"b-root1", "b-root2"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	root := FindNode(nodes, "f-root")
	if len(root.Folder.Children) != 1 {
		t.Fatalf("expected 1 child after bulk delete, got %d", len(root.Folder.Children))
	}
	if root.Folder.Children[0].ID() != "f-sub" {
		t.Fatalf("expected f-sub to remain, got %s", root.Folder.Children[0].ID())
	}
}

func TestDeleteNodesRejectsMixedParents(t *testing.T) {
	nodes := buildTestTree()

	_, err := DeleteNodes(nodes, []string{"b-root1", "b-nested"})
	if err != ErrInvalidTarget {
		t.Fatalf("expected ErrInvalidTarget, got %v", err)
	}
}

// --- MoveNode tests ---

func TestMoveBookmarkToFolder(t *testing.T) {
	nodes := buildTestTree()

	// Move b-root1 into f-sub
	_, err := MoveNode(nodes, "b-root1", "f-sub", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// b-root1 should now be in f-sub
	sub := FindNode(nodes, "f-sub")
	if len(sub.Folder.Children) != 2 {
		t.Errorf("expected 2 children in sub, got %d", len(sub.Folder.Children))
	}
	if sub.Folder.Children[0].Bookmark.ID != "b-root1" {
		t.Error("b-root1 should be first child of sub")
	}

	// f-root should have one fewer child
	root := nodes[0].Folder
	if len(root.Children) != 2 {
		t.Errorf("expected 2 children in root, got %d", len(root.Children))
	}
}

func TestMoveBookmarkPosition(t *testing.T) {
	nodes := buildTestTree()

	// Move b-root2 to position 0 in f-root
	_, err := MoveNode(nodes, "b-root2", "f-root", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	root := nodes[0].Folder
	if root.Children[0].Bookmark.ID != "b-root2" {
		t.Error("b-root2 should be first child of root")
	}
}

func TestMoveBookmarkAppendWithNegativeIndex(t *testing.T) {
	nodes := buildTestTree()

	_, err := MoveNode(nodes, "b-root1", "f-sub", -1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sub := FindNode(nodes, "f-sub")
	if len(sub.Folder.Children) != 2 {
		t.Fatalf("expected 2 children in sub, got %d", len(sub.Folder.Children))
	}
	if sub.Folder.Children[1].Bookmark.ID != "b-root1" {
		t.Error("b-root1 should be appended to the end of sub")
	}
}

func TestMoveBookmarkWithinSameFolderLaterPosition(t *testing.T) {
	nodes := buildTestTree()

	_, err := MoveNode(nodes, "b-root1", "f-root", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	root := FindNode(nodes, "f-root")
	if got := root.Folder.Children[0].Folder.ID; got != "f-sub" {
		t.Fatalf("expected first child to remain f-sub, got %s", got)
	}
	if got := root.Folder.Children[1].Bookmark.ID; got != "b-root1" {
		t.Fatalf("expected b-root1 to move after f-sub, got %s", got)
	}
	if got := root.Folder.Children[2].Bookmark.ID; got != "b-root2" {
		t.Fatalf("expected b-root2 to remain last, got %s", got)
	}
}

func TestMoveRootNodeWithinRootEarlierPosition(t *testing.T) {
	nodes := buildMultiRootTestTree()

	updated, err := MoveNode(nodes, "b-top", "", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := updated[0].Bookmark.ID; got != "b-top" {
		t.Fatalf("expected b-top to move to first root position, got %s", got)
	}
	if got := updated[1].Folder.ID; got != "f-root" {
		t.Fatalf("expected f-root to shift to second root position, got %s", got)
	}
}

func TestMoveRootNodeWithinRootLaterPosition(t *testing.T) {
	nodes := buildMultiRootTestTree()

	updated, err := MoveNode(nodes, "f-root", "", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := updated[0].Bookmark.ID; got != "b-top" {
		t.Fatalf("expected b-top to become first root item, got %s", got)
	}
	if got := updated[1].Folder.ID; got != "f-root" {
		t.Fatalf("expected f-root to move after b-top, got %s", got)
	}
}

func TestMoveNestedNodeToRootPosition(t *testing.T) {
	nodes := buildTestTree()

	updated, err := MoveNode(nodes, "b-nested", "", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got := updated[0].Bookmark.ID; got != "b-nested" {
		t.Fatalf("expected b-nested at first root position, got %s", got)
	}

	sub := FindNode(updated, "f-sub")
	if sub == nil {
		t.Fatal("expected f-sub to remain present")
	}
	if len(sub.Folder.Children) != 0 {
		t.Fatalf("expected f-sub to be empty after moving nested child, got %d children", len(sub.Folder.Children))
	}
}

func TestMoveFolderIntoSelf(t *testing.T) {
	nodes := buildTestTree()
	_, err := MoveNode(nodes, "f-root", "f-root", 0)
	if err != ErrCircularMove {
		t.Errorf("expected ErrCircularMove, got %v", err)
	}
}

func TestMoveFolderIntoDescendant(t *testing.T) {
	nodes := buildTestTree()
	// Try to move f-root into f-sub (which is a child of f-root)
	_, err := MoveNode(nodes, "f-root", "f-sub", 0)
	if err != ErrCircularMove {
		t.Errorf("expected ErrCircularMove, got %v", err)
	}
}

func TestMoveIntoBookmark(t *testing.T) {
	nodes := buildTestTree()
	_, err := MoveNode(nodes, "b-root2", "b-root1", 0)
	if err != ErrInvalidTarget {
		t.Errorf("expected ErrInvalidTarget, got %v", err)
	}
}

func TestMoveNotFound(t *testing.T) {
	nodes := buildTestTree()
	_, err := MoveNode(nodes, "nonexistent", "f-root", 0)
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestMoveNodesPreservesOrder(t *testing.T) {
	nodes := buildTestTree()

	_, err := MoveNodes(nodes, []string{"b-root1", "b-root2"}, "f-sub")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sub := FindNode(nodes, "f-sub")
	if len(sub.Folder.Children) != 3 {
		t.Fatalf("expected 3 children in sub, got %d", len(sub.Folder.Children))
	}
	if sub.Folder.Children[1].ID() != "b-root1" || sub.Folder.Children[2].ID() != "b-root2" {
		t.Fatalf("expected moved bookmarks in original order, got %s then %s", sub.Folder.Children[1].ID(), sub.Folder.Children[2].ID())
	}
}

func TestMoveNodesRejectsSameParentNoOp(t *testing.T) {
	nodes := buildTestTree()

	_, err := MoveNodes(nodes, []string{"b-root1", "b-root2"}, "f-root")
	if err != ErrNoOpMove {
		t.Fatalf("expected ErrNoOpMove, got %v", err)
	}
}

func TestMoveNodesRejectsDescendantTarget(t *testing.T) {
	nodes := buildTestTree()

	_, err := MoveNodes(nodes, []string{"f-sub"}, "f-sub")
	if err != ErrCircularMove {
		t.Fatalf("expected ErrCircularMove, got %v", err)
	}
}

// --- IsDescendant tests ---

func TestIsDescendant(t *testing.T) {
	nodes := buildTestTree()

	if !IsDescendant(nodes, "f-root", "f-sub") {
		t.Error("f-sub should be a descendant of f-root")
	}
	if !IsDescendant(nodes, "f-root", "b-nested") {
		t.Error("b-nested should be a descendant of f-root")
	}
	if !IsDescendant(nodes, "f-sub", "b-nested") {
		t.Error("b-nested should be a descendant of f-sub")
	}
	if IsDescendant(nodes, "f-sub", "f-root") {
		t.Error("f-root should not be a descendant of f-sub")
	}
	if IsDescendant(nodes, "b-root1", "f-root") {
		t.Error("bookmark cannot be an ancestor")
	}
}

// --- BuildFlatIndex tests ---

func TestBuildFlatIndex(t *testing.T) {
	nodes := buildTestTree()

	index := BuildFlatIndex(nodes)

	if len(index) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(index))
	}

	// Build a map for easier checking
	byID := make(map[string]BookmarkIndexEntry)
	for _, e := range index {
		byID[e.NodeID] = e
	}

	// Check nested bookmark
	entry, ok := byID["b-nested"]
	if !ok {
		t.Fatal("b-nested not in index")
	}
	if entry.FolderPath != "Root / Sub" {
		t.Errorf("expected path 'Root / Sub', got '%s'", entry.FolderPath)
	}

	// Check root-level bookmark
	entry, ok = byID["b-root1"]
	if !ok {
		t.Fatal("b-root1 not in index")
	}
	if entry.FolderPath != "Root" {
		t.Errorf("expected path 'Root', got '%s'", entry.FolderPath)
	}
	if entry.Title != "Root Bookmark 1" {
		t.Errorf("expected 'Root Bookmark 1', got '%s'", entry.Title)
	}
}
