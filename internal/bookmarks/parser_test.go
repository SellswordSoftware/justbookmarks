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

	bm2 := root.Folder.Children[1]
	if bm2.Bookmark.URL != "https://linear.app" {
		t.Errorf("expected linear URL, got '%s'", bm2.Bookmark.URL)
	}
	if bm2.Bookmark.Title != "Linear" {
		t.Errorf("expected 'Linear', got '%s'", bm2.Bookmark.Title)
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

	if len(root.Folder.Children) != 2 {
		t.Fatalf("expected 2 children in root, got %d", len(root.Folder.Children))
	}

	subFolder := root.Folder.Children[0]
	if subFolder.Type != TypeFolder {
		t.Fatal("expected first child to be a folder")
	}
	if subFolder.Folder.Name != "Sub Folder" {
		t.Errorf("expected 'Sub Folder', got '%s'", subFolder.Folder.Name)
	}

	if len(subFolder.Folder.Children) != 1 {
		t.Fatalf("expected 1 child in sub folder, got %d", len(subFolder.Folder.Children))
	}

	bm := subFolder.Folder.Children[0]
	if bm.Bookmark.URL != "https://example.com" {
		t.Errorf("expected example.com, got '%s'", bm.Bookmark.URL)
	}

	// Second child of root should be the Google bookmark
	google := root.Folder.Children[1]
	if google.Type != TypeBookmark {
		t.Fatal("expected second root child to be a bookmark")
	}
	if google.Bookmark.URL != "https://google.com" {
		t.Errorf("expected google.com, got '%s'", google.Bookmark.URL)
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
	if folder.LastModified.Unix() != 1700000000 {
		t.Errorf("expected last_modified 1700000000, got %d", folder.LastModified.Unix())
	}

	bm := nodes[0].Folder.Children[0]
	if bm.Bookmark.AddDate.Unix() != 1700000001 {
		t.Errorf("expected add_date 1700000001, got %d", bm.Bookmark.AddDate.Unix())
	}
}

func TestParseEmptyFile(t *testing.T) {
	_, err := Parse([]byte("<html></html>"))
	if err == nil {
		t.Error("expected error for empty HTML")
	}
}

func TestParseInvalidHTML(t *testing.T) {
	_, err := Parse([]byte("\x00\x01\x02\x03"))
	if err == nil {
		t.Error("expected error for invalid HTML")
	}
}
