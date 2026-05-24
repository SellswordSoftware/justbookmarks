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
