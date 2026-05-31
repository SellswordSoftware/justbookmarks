package bookmarks

import (
	"testing"
)

func TestFlattenTree_Empty(t *testing.T) {
	result := FlattenTree(nil)
	if result != nil {
		t.Errorf("expected nil for empty input, got %v", result)
	}
}

func TestFlattenTree_Flat(t *testing.T) {
	nodes := []Node{
		{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1", Title: "Google", URL: "https://google.com"}},
		{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b2", Title: "GitHub", URL: "https://github.com"}},
	}

	result := FlattenTree(nodes)
	if len(result) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(result))
	}

	if result[0].ID != "b1" || result[0].ParentID != "" {
		t.Errorf("first node: ID=%q ParentID=%q, want ID=%q ParentID=%q", result[0].ID, result[0].ParentID, "b1", "")
	}
	if result[1].ID != "b2" || result[1].ParentID != "" {
		t.Errorf("second node: ID=%q ParentID=%q, want ID=%q ParentID=%q", result[1].ID, result[1].ParentID, "b2", "")
	}
}

func TestFlattenTree_Nested(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:   "f1",
				Name: "Root",
				Children: []Node{
					{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1", Title: "Google", URL: "https://google.com"}},
					{
						Type: TypeFolder,
						Folder: &Folder{
							ID:   "f2",
							Name: "Nested",
							Children: []Node{
								{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b2", Title: "GitHub", URL: "https://github.com"}},
							},
						},
					},
				},
			},
		},
	}

	result := FlattenTree(nodes)
	if len(result) != 4 {
		t.Fatalf("expected 4 nodes, got %d", len(result))
	}

	// Check parent IDs
	wantParents := map[string]string{
		"f1": "",    // root folder
		"b1": "f1",  // bookmark in root
		"f2": "f1",  // nested folder
		"b2": "f2",  // bookmark in nested
	}

	for _, node := range result {
		wantParent, ok := wantParents[node.ID]
		if !ok {
			t.Errorf("unexpected node ID: %q", node.ID)
			continue
		}
		if node.ParentID != wantParent {
			t.Errorf("node %q: ParentID=%q, want %q", node.ID, node.ParentID, wantParent)
		}
	}
}

func TestFlattenTree_ChildCount(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:   "f1",
				Name: "Root",
				Children: []Node{
					{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1", Title: "Google", URL: "https://google.com"}},
					{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b2", Title: "GitHub", URL: "https://github.com"}},
				},
			},
		},
	}

	result := FlattenTree(nodes)
	for _, node := range result {
		if node.ID == "f1" && node.ChildCount != 2 {
			t.Errorf("folder f1: ChildCount=%d, want 2", node.ChildCount)
		}
		if node.Type == TypeBookmark && node.ChildCount != 0 {
			t.Errorf("bookmark %q: ChildCount=%d, want 0", node.ID, node.ChildCount)
		}
	}
}

func TestNewFlatNode_Folder(t *testing.T) {
	node := Node{
		Type: TypeFolder,
		Folder: &Folder{
			ID:       "f1",
			Name:     "Test Folder",
			Children: []Node{
				{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1"}},
				{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b2"}},
			},
		},
	}

	dto := NewFlatNode(node, "parent-id")
	if dto.ID != "f1" {
		t.Errorf("ID=%q, want %q", dto.ID, "f1")
	}
	if dto.Type != TypeFolder {
		t.Errorf("Type=%v, want %v", dto.Type, TypeFolder)
	}
	if dto.ParentID != "parent-id" {
		t.Errorf("ParentID=%q, want %q", dto.ParentID, "parent-id")
	}
	if dto.Name != "Test Folder" {
		t.Errorf("Name=%q, want %q", dto.Name, "Test Folder")
	}
	if dto.ChildCount != 2 {
		t.Errorf("ChildCount=%d, want 2", dto.ChildCount)
	}
}

func TestNewFlatNode_Bookmark(t *testing.T) {
	node := Node{
		Type: TypeBookmark,
		Bookmark: &Bookmark{
			ID:    "b1",
			Title: "Google",
			URL:   "https://google.com",
		},
	}

	dto := NewFlatNode(node, "f1")
	if dto.ID != "b1" {
		t.Errorf("ID=%q, want %q", dto.ID, "b1")
	}
	if dto.Type != TypeBookmark {
		t.Errorf("Type=%v, want %v", dto.Type, TypeBookmark)
	}
	if dto.ParentID != "f1" {
		t.Errorf("ParentID=%q, want %q", dto.ParentID, "f1")
	}
	if dto.Name != "Google" {
		t.Errorf("Name=%q, want %q", dto.Name, "Google")
	}
	if dto.URL != "https://google.com" {
		t.Errorf("URL=%q, want %q", dto.URL, "https://google.com")
	}
	if dto.ChildCount != 0 {
		t.Errorf("ChildCount=%d, want 0", dto.ChildCount)
	}
}

func TestFindFolder(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:   "f1",
				Name: "Root",
				Children: []Node{
					{Type: TypeBookmark, Bookmark: &Bookmark{ID: "b1", Title: "Google"}},
					{
						Type: TypeFolder,
						Folder: &Folder{
							ID:   "f2",
							Name: "Nested",
						},
					},
				},
			},
		},
	}

	// Find existing folder
	found := FindFolder(nodes, "f1")
	if found == nil {
		t.Error("expected to find folder f1")
	} else if found.ID() != "f1" {
		t.Errorf("found ID=%q, want %q", found.ID(), "f1")
	}

	// Find nested folder
	found = FindFolder(nodes, "f2")
	if found == nil {
		t.Error("expected to find folder f2")
	} else if found.ID() != "f2" {
		t.Errorf("found ID=%q, want %q", found.ID(), "f2")
	}

	// Find bookmark (should return nil)
	found = FindFolder(nodes, "b1")
	if found != nil {
		t.Errorf("expected nil for bookmark, got ID=%q", found.ID())
	}

	// Find non-existent
	found = FindFolder(nodes, "nonexistent")
	if found != nil {
		t.Errorf("expected nil for nonexistent, got ID=%q", found.ID())
	}
}
