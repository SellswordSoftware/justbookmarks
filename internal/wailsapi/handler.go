package wailsapi

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
	"golang.org/x/net/html"
)

// Handler exposes bookmark operations to the Wails frontend.
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
	if err := h.save(); err != nil {
		return "", err
	}
	return bm.ID, nil
}

// AddFolder adds a folder and auto-saves.
func (h *Handler) AddFolder(parentID string, name string) (string, error) {
	var err error
	h.tree, err = bookmarks.AddFolder(h.tree, parentID, name)
	if err != nil {
		return "", err
	}
	if err := h.save(); err != nil {
		return "", err
	}
	return "", nil
}

// UpdateBookmark updates a bookmark and auto-saves.
func (h *Handler) UpdateBookmark(id string, patch bookmarks.BookmarkPatch) error {
	err := bookmarks.UpdateBookmark(h.tree, id, patch)
	if err != nil {
		return err
	}
	return h.save()
}

// UpdateFolderName renames a folder and auto-saves.
func (h *Handler) UpdateFolderName(id string, name string) error {
	err := bookmarks.UpdateFolderName(h.tree, id, name)
	if err != nil {
		return err
	}
	return h.save()
}

// DeleteNode deletes a node and auto-saves.
func (h *Handler) DeleteNode(id string) error {
	var err error
	h.tree, err = bookmarks.DeleteNode(h.tree, id)
	if err != nil {
		return err
	}
	return h.save()
}

// MoveNode moves a node and auto-saves.
func (h *Handler) MoveNode(nodeID, newParentID string, newIndex int) error {
	var err error
	h.tree, err = bookmarks.MoveNode(h.tree, nodeID, newParentID, newIndex)
	if err != nil {
		return err
	}
	return h.save()
}

// FetchPageTitle fetches the <title> from a URL.
func (h *Handler) FetchPageTitle(pageURL string) (string, error) {
	client := &http.Client{
		Timeout:       3 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
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

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/png"
	}

	return fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(data)), nil
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
	if err := os.WriteFile(h.filePath, []byte(output), 0644); err != nil {
		return fmt.Errorf("failed to save bookmarks: %w", err)
	}
	return nil
}

// FilePath returns the currently loaded file path.
func (h *Handler) FilePath() string {
	return h.filePath
}
