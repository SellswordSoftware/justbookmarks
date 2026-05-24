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
	"strings"
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

// DeleteNodes deletes multiple nodes and auto-saves once.
func (h *Handler) DeleteNodes(ids []string) error {
	var err error
	h.tree, err = bookmarks.DeleteNodes(h.tree, ids)
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

// MoveNodes moves multiple nodes and auto-saves once.
func (h *Handler) MoveNodes(nodeIDs []string, targetFolderID string) error {
	var err error
	h.tree, err = bookmarks.MoveNodes(h.tree, nodeIDs, targetFolderID)
	if err != nil {
		return err
	}
	return h.save()
}

// FetchPageTitle fetches the <title> from a URL.
func (h *Handler) FetchPageTitle(pageURL string) (string, error) {
	client := &http.Client{
		Timeout: 3 * time.Second,
	}
	return fetchPageTitleWithClient(client, pageURL)
}

func fetchPageTitleWithClient(client *http.Client, pageURL string) (string, error) {
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Second}
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

// FetchFavicon fetches a favicon for a URL by preferring the page's declared icon,
// then falling back to /favicon.ico, then finally to Google's favicon service.
func (h *Handler) FetchFavicon(pageURL string) (string, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	return fetchFaviconWithClient(client, pageURL)
}

// FetchFaviconsForNodes refreshes bookmark favicons and saves once at the end.
func (h *Handler) FetchFaviconsForNodes(ids []string) error {
	client := &http.Client{Timeout: 5 * time.Second}
	successes := 0
	nodes, err := h.collectBookmarks(ids)
	if err != nil {
		return err
	}

	for _, node := range nodes {
		icon, fetchErr := fetchFaviconWithClient(client, node.Bookmark.URL)
		if fetchErr != nil || icon == "" {
			continue
		}
		node.Bookmark.Icon = icon
		node.Bookmark.LastModified = time.Now()
		successes++
	}

	if successes == 0 {
		return fmt.Errorf("failed to fetch favicons for selected bookmarks")
	}

	return h.save()
}

// RefreshTitlesForNodes refreshes bookmark titles and saves once at the end.
func (h *Handler) RefreshTitlesForNodes(ids []string) error {
	client := &http.Client{Timeout: 3 * time.Second}
	successes := 0
	nodes, err := h.collectBookmarks(ids)
	if err != nil {
		return err
	}

	for _, node := range nodes {
		title, fetchErr := fetchPageTitleWithClient(client, node.Bookmark.URL)
		if fetchErr != nil || title == "" {
			continue
		}
		node.Bookmark.Title = title
		node.Bookmark.LastModified = time.Now()
		successes++
	}

	if successes == 0 {
		return fmt.Errorf("failed to refresh titles for selected bookmarks")
	}

	return h.save()
}

func (h *Handler) collectBookmarks(ids []string) ([]*bookmarks.Node, error) {
	result := make([]*bookmarks.Node, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))

	for _, id := range ids {
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}

		node := bookmarks.FindNode(h.tree, id)
		if node == nil {
			return nil, bookmarks.ErrNotFound
		}
		if node.Type != bookmarks.TypeBookmark {
			return nil, fmt.Errorf("node %s is not a bookmark", id)
		}
		result = append(result, node)
	}

	return result, nil
}

func fetchFaviconWithClient(client *http.Client, pageURL string) (string, error) {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}

	u, err := url.Parse(pageURL)
	if err != nil {
		return "", fmt.Errorf("invalid URL: %w", err)
	}

	if iconData, err := fetchDeclaredFavicon(client, u); err == nil && iconData != "" {
		return iconData, nil
	}

	if fallbackData, err := fetchIconURL(client, u.ResolveReference(&url.URL{Path: "/favicon.ico"}).String()); err == nil && fallbackData != "" {
		return fallbackData, nil
	}

	faviconURL := fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s&sz=32", u.Host)
	return fetchIconURL(client, faviconURL)
}

func fetchDeclaredFavicon(client *http.Client, pageURL *url.URL) (string, error) {
	resp, err := client.Get(pageURL.String())
	if err != nil {
		return "", fmt.Errorf("failed to fetch favicon: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	doc, err := html.Parse(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to parse favicon HTML: %w", err)
	}

	for _, href := range extractIconHrefs(doc) {
		iconURL, err := pageURL.Parse(href)
		if err != nil {
			continue
		}
		data, err := fetchIconURL(client, iconURL.String())
		if err == nil && data != "" {
			return data, nil
		}
	}

	return "", fmt.Errorf("no declared favicon found")
}

func fetchIconURL(client *http.Client, iconURL string) (string, error) {
	resp, err := client.Get(iconURL)
	if err != nil {
		return "", fmt.Errorf("failed to fetch favicon: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

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

func extractIconHrefs(n *html.Node) []string {
	var hrefs []string

	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "link" {
			var relValue string
			var hrefValue string

			for _, attr := range node.Attr {
				switch strings.ToLower(attr.Key) {
				case "rel":
					relValue = strings.ToLower(attr.Val)
				case "href":
					hrefValue = attr.Val
				}
			}

			if hrefValue != "" && isIconRel(relValue) {
				hrefs = append(hrefs, hrefValue)
			}
		}

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}

	walk(n)
	return hrefs
}

func isIconRel(rel string) bool {
	for _, part := range strings.Fields(rel) {
		if part == "icon" || part == "shortcut" || part == "apple-touch-icon" || part == "apple-touch-icon-precomposed" {
			return true
		}
	}
	return false
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
