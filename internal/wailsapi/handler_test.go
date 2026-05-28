package wailsapi

import (
	"encoding/base64"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestFetchPageTitleFollowsRedirect(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/source":
				return &http.Response{
					StatusCode: http.StatusMovedPermanently,
					Header: http.Header{
						"Location": []string{"http://example.test/final"},
					},
					Body:    io.NopCloser(strings.NewReader("")),
					Request: req,
				}, nil
			case "/final":
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type": []string{"text/html; charset=utf-8"},
					},
					Body:    io.NopCloser(strings.NewReader("<html><head><title>Redirected Title</title></head><body></body></html>")),
					Request: req,
				}, nil
			default:
				t.Fatalf("unexpected path requested: %s", req.URL.Path)
				return nil, nil
			}
		}),
	}

	title, err := fetchPageTitleWithClient(client, "http://example.test/source")
	if err != nil {
		t.Fatalf("expected redirecting title fetch to succeed, got error: %v", err)
	}

	if title != "Redirected Title" {
		t.Fatalf("expected redirected title, got %q", title)
	}
}

func TestFetchFaviconPrefersDeclaredIcon(t *testing.T) {
	iconBytes := []byte("png-bytes")

	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.String() {
			case "http://example.test/repo":
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type": []string{"text/html; charset=utf-8"},
					},
					Body:    io.NopCloser(strings.NewReader(`<html><head><link rel="icon" href="/assets/img/favicon.png"></head><body></body></html>`)),
					Request: req,
				}, nil
			case "http://example.test/assets/img/favicon.png":
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type": []string{"image/png"},
					},
					Body:    io.NopCloser(strings.NewReader(string(iconBytes))),
					Request: req,
				}, nil
			default:
				t.Fatalf("unexpected URL requested: %s", req.URL.String())
				return nil, nil
			}
		}),
	}

	dataURI, err := fetchFaviconWithClient(client, "http://example.test/repo")
	if err != nil {
		t.Fatalf("expected favicon fetch to succeed, got %v", err)
	}

	expected := "data:image/png;base64," + base64.StdEncoding.EncodeToString(iconBytes)
	if dataURI != expected {
		t.Fatalf("expected %q, got %q", expected, dataURI)
	}
}

func TestPreviewImportMergeParseFailureReturnsError(t *testing.T) {
	dir := t.TempDir()
	currentPath := filepath.Join(dir, "current.html")
	if err := os.WriteFile(currentPath, []byte(bookmarks.Serialize([]bookmarks.Node{})), 0o644); err != nil {
		t.Fatalf("failed to write current file: %v", err)
	}

	handler := NewHandler()
	if err := handler.LoadFile(currentPath); err != nil {
		t.Fatalf("failed to load current file: %v", err)
	}

	badPath := filepath.Join(dir, "bad.html")
	if err := os.WriteFile(badPath, []byte("<html></html>"), 0o644); err != nil {
		t.Fatalf("failed to write import file: %v", err)
	}

	if _, err := handler.PreviewImportMerge(badPath); err == nil {
		t.Fatal("expected parse failure from PreviewImportMerge")
	}
}

func TestApplyImportMergeSavesOnceAndUpdatesTree(t *testing.T) {
	dir := t.TempDir()
	currentPath := filepath.Join(dir, "current.html")
	importPath := filepath.Join(dir, "import.html")

	currentTree := []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
			},
		},
	}
	importTree := []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "x-work",
				Name: "Work",
				Children: []bookmarks.Node{
					{
						Type: bookmarks.TypeBookmark,
						Bookmark: &bookmarks.Bookmark{
							ID:    "x-gh",
							Title: "GitHub",
							URL:   "https://github.com",
						},
					},
				},
			},
		},
	}

	if err := os.WriteFile(currentPath, []byte(bookmarks.Serialize(currentTree)), 0o644); err != nil {
		t.Fatalf("failed to write current file: %v", err)
	}
	if err := os.WriteFile(importPath, []byte(bookmarks.Serialize(importTree)), 0o644); err != nil {
		t.Fatalf("failed to write import file: %v", err)
	}

	handler := NewHandler()
	if err := handler.LoadFile(currentPath); err != nil {
		t.Fatalf("failed to load current file: %v", err)
	}

	result, err := handler.ApplyImportMerge(importPath)
	if err != nil {
		t.Fatalf("ApplyImportMerge returned error: %v", err)
	}

	if result.BookmarksAdded != 1 || result.FoldersAdded != 0 {
		t.Fatalf("unexpected merge result: %+v", result)
	}

	savedData, err := os.ReadFile(currentPath)
	if err != nil {
		t.Fatalf("failed to read saved file: %v", err)
	}
	if !strings.Contains(string(savedData), "GitHub") {
		t.Fatalf("expected saved file to contain merged bookmark, got %s", string(savedData))
	}

	workFolder := handler.GetTree()[0].Folder
	if len(workFolder.Children) != 1 || workFolder.Children[0].Bookmark == nil || workFolder.Children[0].Bookmark.Title != "GitHub" {
		t.Fatalf("expected in-memory tree to include merged bookmark, got %+v", handler.GetTree())
	}
}

func TestApplyImportMergeNoChangesReturnsZeroAddSummary(t *testing.T) {
	dir := t.TempDir()
	currentPath := filepath.Join(dir, "current.html")
	importPath := filepath.Join(dir, "import.html")

	tree := []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
				Children: []bookmarks.Node{
					{
						Type: bookmarks.TypeBookmark,
						Bookmark: &bookmarks.Bookmark{
							ID:    "b-gh",
							Title: "GitHub",
							URL:   "https://github.com",
						},
					},
				},
			},
		},
	}

	serialized := []byte(bookmarks.Serialize(tree))
	if err := os.WriteFile(currentPath, serialized, 0o644); err != nil {
		t.Fatalf("failed to write current file: %v", err)
	}
	if err := os.WriteFile(importPath, serialized, 0o644); err != nil {
		t.Fatalf("failed to write import file: %v", err)
	}

	handler := NewHandler()
	if err := handler.LoadFile(currentPath); err != nil {
		t.Fatalf("failed to load current file: %v", err)
	}

	result, err := handler.ApplyImportMerge(importPath)
	if err != nil {
		t.Fatalf("ApplyImportMerge returned error: %v", err)
	}

	if result.FoldersAdded != 0 || result.BookmarksAdded != 0 || result.DuplicatesSkipped != 1 || result.PotentialUpdates != 0 {
		t.Fatalf("unexpected merge result: %+v", result)
	}
}

func TestUndoRedoTracksHistoryForRename(t *testing.T) {
	handler, path := loadHandlerWithTree(t, []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
			},
		},
	})
	folderID := handler.GetTree()[0].ID

	if err := handler.UpdateFolderName(folderID, "Projects"); err != nil {
		t.Fatalf("UpdateFolderName returned error: %v", err)
	}

	state := handler.GetHistoryState()
	if !state.CanUndo || state.UndoLabel != "Rename Folder" || state.CanRedo {
		t.Fatalf("unexpected history state after rename: %+v", state)
	}
	if got := handler.GetTree()[0].Folder.Name; got != "Projects" {
		t.Fatalf("expected renamed folder, got %q", got)
	}

	if _, err := handler.Undo(); err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	if got := handler.GetTree()[0].Folder.Name; got != "Work" {
		t.Fatalf("expected original folder name after undo, got %q", got)
	}

	undoneData, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file after undo: %v", err)
	}
	if !strings.Contains(string(undoneData), "Work") {
		t.Fatalf("expected saved file to contain original folder name, got %s", string(undoneData))
	}

	state = handler.GetHistoryState()
	if !state.CanRedo || state.RedoLabel != "Rename Folder" {
		t.Fatalf("unexpected history state after undo: %+v", state)
	}

	if _, err := handler.Redo(); err != nil {
		t.Fatalf("Redo returned error: %v", err)
	}
	if got := handler.GetTree()[0].Folder.Name; got != "Projects" {
		t.Fatalf("expected renamed folder after redo, got %q", got)
	}
}

func TestNewCommandClearsRedoStack(t *testing.T) {
	handler, _ := loadHandlerWithTree(t, []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
			},
		},
	})
	folderID := handler.GetTree()[0].ID

	if err := handler.UpdateFolderName(folderID, "Projects"); err != nil {
		t.Fatalf("UpdateFolderName returned error: %v", err)
	}
	if _, err := handler.Undo(); err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	if _, err := handler.AddFolder("", "Personal"); err != nil {
		t.Fatalf("AddFolder returned error: %v", err)
	}

	state := handler.GetHistoryState()
	if state.CanRedo {
		t.Fatalf("expected redo stack to be cleared, got %+v", state)
	}
}

func TestLoadFileClearsHistory(t *testing.T) {
	handler, _ := loadHandlerWithTree(t, []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
			},
		},
	})
	folderID := handler.GetTree()[0].ID

	if err := handler.UpdateFolderName(folderID, "Projects"); err != nil {
		t.Fatalf("UpdateFolderName returned error: %v", err)
	}

	otherPath := filepath.Join(t.TempDir(), "other.html")
	if err := os.WriteFile(otherPath, []byte(bookmarks.Serialize([]bookmarks.Node{})), 0o644); err != nil {
		t.Fatalf("failed to write other file: %v", err)
	}
	if err := handler.LoadFile(otherPath); err != nil {
		t.Fatalf("LoadFile returned error: %v", err)
	}

	state := handler.GetHistoryState()
	if state.CanUndo || state.CanRedo {
		t.Fatalf("expected history to be cleared on load, got %+v", state)
	}
}

func TestUndoEmptyStackReturnsStableError(t *testing.T) {
	handler := NewHandler()
	if _, err := handler.Undo(); err != ErrNothingToUndo {
		t.Fatalf("expected ErrNothingToUndo, got %v", err)
	}
}

func TestRedoEmptyStackReturnsStableError(t *testing.T) {
	handler := NewHandler()
	if _, err := handler.Redo(); err != ErrNothingToRedo {
		t.Fatalf("expected ErrNothingToRedo, got %v", err)
	}
}

func TestFailedSaveDoesNotMutateTreeOrHistory(t *testing.T) {
	handler, _ := loadHandlerWithTree(t, []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
			},
		},
	})
	folderID := handler.GetTree()[0].ID

	handler.filePath = t.TempDir()

	err := handler.UpdateFolderName(folderID, "Projects")
	if err == nil {
		t.Fatal("expected save failure from UpdateFolderName")
	}

	if got := handler.GetTree()[0].Folder.Name; got != "Work" {
		t.Fatalf("expected tree to remain unchanged after failed save, got %q", got)
	}

	state := handler.GetHistoryState()
	if state.CanUndo || state.CanRedo {
		t.Fatalf("expected history to remain unchanged after failed save, got %+v", state)
	}
}

func TestUndoRestoresTreeAfterImportMerge(t *testing.T) {
	dir := t.TempDir()
	currentPath := filepath.Join(dir, "current.html")
	importPath := filepath.Join(dir, "import.html")

	currentTree := []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "f-work",
				Name: "Work",
			},
		},
	}
	importTree := []bookmarks.Node{
		{
			Type: bookmarks.TypeFolder,
			Folder: &bookmarks.Folder{
				ID:   "x-work",
				Name: "Work",
				Children: []bookmarks.Node{
					{
						Type: bookmarks.TypeBookmark,
						Bookmark: &bookmarks.Bookmark{
							ID:    "x-gh",
							Title: "GitHub",
							URL:   "https://github.com",
						},
					},
				},
			},
		},
	}

	if err := os.WriteFile(currentPath, []byte(bookmarks.Serialize(currentTree)), 0o644); err != nil {
		t.Fatalf("failed to write current file: %v", err)
	}
	if err := os.WriteFile(importPath, []byte(bookmarks.Serialize(importTree)), 0o644); err != nil {
		t.Fatalf("failed to write import file: %v", err)
	}

	handler := NewHandler()
	if err := handler.LoadFile(currentPath); err != nil {
		t.Fatalf("failed to load current file: %v", err)
	}
	if _, err := handler.ApplyImportMerge(importPath); err != nil {
		t.Fatalf("ApplyImportMerge returned error: %v", err)
	}

	if _, err := handler.Undo(); err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}

	workFolder := handler.GetTree()[0].Folder
	if len(workFolder.Children) != 0 {
		t.Fatalf("expected merge undo to restore pre-merge tree, got %+v", handler.GetTree())
	}
}

func loadHandlerWithTree(t *testing.T, tree []bookmarks.Node) (*Handler, string) {
	t.Helper()

	path := filepath.Join(t.TempDir(), "bookmarks.html")
	if err := os.WriteFile(path, []byte(bookmarks.Serialize(tree)), 0o644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	handler := NewHandler()
	if err := handler.LoadFile(path); err != nil {
		t.Fatalf("failed to load test file: %v", err)
	}

	return handler, path
}
