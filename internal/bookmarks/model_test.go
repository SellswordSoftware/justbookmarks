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

func TestNodeTypeString(t *testing.T) {
	if TypeFolder.String() != "folder" {
		t.Errorf("expected 'folder', got '%s'", TypeFolder.String())
	}
	if TypeBookmark.String() != "bookmark" {
		t.Errorf("expected 'bookmark', got '%s'", TypeBookmark.String())
	}
}

func TestGenerateID(t *testing.T) {
	id1 := GenerateID()
	id2 := GenerateID()
	if id1 == id2 {
		t.Error("expected unique IDs")
	}
	if id1 == "" || id2 == "" {
		t.Error("expected non-empty IDs")
	}
}
