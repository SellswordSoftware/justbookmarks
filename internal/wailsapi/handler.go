package wailsapi

import (
	"encoding/base64"
	"errors"
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
	filePath  string
	tree      []bookmarks.Node
	undoStack []bookmarks.Command
	redoStack []bookmarks.Command
}

var (
	ErrNothingToUndo = errors.New("nothing to undo")
	ErrNothingToRedo = errors.New("nothing to redo")
)

// NewHandler creates a new API handler.
func NewHandler() *Handler {
	return &Handler{}
}

// LoadFile loads a Netscape bookmark HTML file and parses it into the tree.
func (h *Handler) LoadFile(path string) error {
	tree, err := loadNodesFromPath(path)
	if err != nil {
		return err
	}

	h.filePath = path
	h.tree = tree
	h.clearHistory()
	return nil
}

// GetFlatTree returns the current bookmark tree as a flat list of nodes.
// Each node has a parentId reference instead of nested children.
func (h *Handler) GetFlatTree() []bookmarks.FlatNode {
	return bookmarks.FlattenTree(h.tree)
}

// GetRootNodes returns only the root-level nodes as flat DTOs.
// Used for lazy loading -- initial load only sends the top level.
func (h *Handler) GetRootNodes() []bookmarks.FlatNode {
	return flattenNodes(h.tree, "")
}

// GetFolderChildren returns the direct children of a folder as flat DTOs.
// Used for lazy loading -- fetches a folder's contents on demand.
func (h *Handler) GetFolderChildren(folderID string) []bookmarks.FlatNode {
	folder := bookmarks.FindFolder(h.tree, folderID)
	if folder == nil {
		return nil
	}
	return flattenNodes(folder.Folder.Children, folderID)
}

// flattenNodes converts a slice of Node to FlatNode with a given parentID.
func flattenNodes(nodes []bookmarks.Node, parentID string) []bookmarks.FlatNode {
	if len(nodes) == 0 {
		return nil
	}
	result := make([]bookmarks.FlatNode, 0, len(nodes))
	for _, node := range nodes {
		dto := bookmarks.NewFlatNode(node, parentID)
		result = append(result, dto)
	}
	return result
}

// GetFlatIndex returns a flat index of all bookmarks for search.
func (h *Handler) GetFlatIndex() []bookmarks.BookmarkIndexEntry {
	return bookmarks.BuildFlatIndex(h.tree)
}

// GetAllFolders returns all folder nodes in the tree (for move target selection).
func (h *Handler) GetAllFolders() []NodeDTO {
	return toNodeDTOs(collectFolders(h.tree))
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
func (h *Handler) AddBookmark(parentID string, bm BookmarkCreateDTO) (string, error) {
	beforeIDs := collectNodeIDs(h.tree)
	var createdID string
	err := h.executeSnapshotCommand("Add Bookmark", func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		nextTree, err := bookmarks.AddBookmark(nodes, parentID, toBookmarkCreate(bm))
		if err != nil {
			return nil, err
		}
		if created := findNewNodeID(nextTree, beforeIDs); created != "" {
			createdID = created
		}
		return nextTree, nil
	})
	if err != nil {
		return "", err
	}
	return createdID, nil
}

// AddFolder adds a folder and auto-saves.
func (h *Handler) AddFolder(parentID string, name string) (string, error) {
	beforeIDs := collectNodeIDs(h.tree)
	var createdID string
	err := h.executeSnapshotCommand("Add Folder", func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		nextTree, err := bookmarks.AddFolder(nodes, parentID, name)
		if err != nil {
			return nil, err
		}
		if created := findNewNodeID(nextTree, beforeIDs); created != "" {
			createdID = created
		}
		return nextTree, nil
	})
	if err != nil {
		return "", err
	}
	return createdID, nil
}

// UpdateBookmark updates a bookmark and auto-saves.
func (h *Handler) UpdateBookmark(id string, patch BookmarkPatchDTO) error {
	return h.executeSnapshotCommand("Edit Bookmark", func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		if err := bookmarks.UpdateBookmark(nodes, id, toBookmarkPatch(patch)); err != nil {
			return nil, err
		}
		return nodes, nil
	})
}

// UpdateFolderName renames a folder and auto-saves.
func (h *Handler) UpdateFolderName(id string, name string) error {
	return h.executeSnapshotCommand("Rename Folder", func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		if err := bookmarks.UpdateFolderName(nodes, id, name); err != nil {
			return nil, err
		}
		return nodes, nil
	})
}

// DeleteNode deletes a node and auto-saves.
func (h *Handler) DeleteNode(id string) error {
	label := "Delete Bookmark"
	if node := bookmarks.FindNode(h.tree, id); node != nil && node.Type == bookmarks.TypeFolder {
		label = "Delete Folder"
	}

	return h.executeSnapshotCommand(label, func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		return bookmarks.DeleteNode(nodes, id)
	})
}

// DeleteNodes deletes multiple nodes and auto-saves once.
func (h *Handler) DeleteNodes(ids []string) error {
	label := fmt.Sprintf("Delete %d Items", len(ids))
	if len(ids) > 0 {
		if node := bookmarks.FindNode(h.tree, ids[0]); node != nil {
			if node.Type == bookmarks.TypeFolder {
				label = fmt.Sprintf("Delete %d Folders", len(ids))
			} else {
				label = fmt.Sprintf("Delete %d Bookmarks", len(ids))
			}
		}
	}

	return h.executeSnapshotCommand(label, func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		return bookmarks.DeleteNodes(nodes, ids)
	})
}

// MoveNode moves a node and auto-saves.
func (h *Handler) MoveNode(nodeID, newParentID string, newIndex int) error {
	label := "Move Bookmark"
	if node := bookmarks.FindNode(h.tree, nodeID); node != nil && node.Type == bookmarks.TypeFolder {
		label = "Move Folder"
	}

	return h.executeSnapshotCommand(label, func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		return bookmarks.MoveNode(nodes, nodeID, newParentID, newIndex)
	})
}

// MoveNodes moves multiple nodes and auto-saves once.
func (h *Handler) MoveNodes(nodeIDs []string, targetFolderID string) error {
	label := fmt.Sprintf("Move %d Items", len(nodeIDs))
	if len(nodeIDs) > 0 {
		if node := bookmarks.FindNode(h.tree, nodeIDs[0]); node != nil {
			if node.Type == bookmarks.TypeFolder {
				label = fmt.Sprintf("Move %d Folders", len(nodeIDs))
			} else {
				label = fmt.Sprintf("Move %d Bookmarks", len(nodeIDs))
			}
		}
	}

	return h.executeSnapshotCommand(label, func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		return bookmarks.MoveNodes(nodes, nodeIDs, targetFolderID)
	})
}

// PreviewImportMerge loads another bookmark file and reports what would be merged.
func (h *Handler) PreviewImportMerge(path string) (bookmarks.MergePreview, error) {
	if h.filePath == "" {
		return bookmarks.MergePreview{}, fmt.Errorf("no bookmark file is currently loaded")
	}

	incoming, err := loadNodesFromPath(path)
	if err != nil {
		return bookmarks.MergePreview{}, err
	}

	return bookmarks.PreviewMerge(h.tree, incoming)
}

// ApplyImportMerge loads another bookmark file, merges additive changes, and saves once.
func (h *Handler) ApplyImportMerge(path string) (bookmarks.MergeApplyResult, error) {
	if h.filePath == "" {
		return bookmarks.MergeApplyResult{}, fmt.Errorf("no bookmark file is currently loaded")
	}

	incoming, err := loadNodesFromPath(path)
	if err != nil {
		return bookmarks.MergeApplyResult{}, err
	}

	working := bookmarks.CloneTree(h.tree)
	merged, result, err := bookmarks.ApplyMerge(working, incoming)
	if err != nil {
		return bookmarks.MergeApplyResult{}, err
	}

	if err := h.commitSnapshotCommand("Import Merge", bookmarks.CloneTree(h.tree), merged); err != nil {
		return bookmarks.MergeApplyResult{}, err
	}

	return result, nil
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
	return h.executeSnapshotCommand("Refresh Favicons", func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		successes := 0
		bookmarksToUpdate, err := collectBookmarksFromTree(nodes, ids)
		if err != nil {
			return nil, err
		}

		for _, node := range bookmarksToUpdate {
			icon, fetchErr := fetchFaviconWithClient(client, node.Bookmark.URL)
			if fetchErr != nil || icon == "" || icon == node.Bookmark.Icon {
				continue
			}
			node.Bookmark.Icon = icon
			node.Bookmark.LastModified = time.Now()
			successes++
		}

		if successes == 0 {
			return nil, fmt.Errorf("failed to fetch favicons for selected bookmarks")
		}

		return nodes, nil
	})
}

// RefreshTitlesForNodes refreshes bookmark titles and saves once at the end.
func (h *Handler) RefreshTitlesForNodes(ids []string) error {
	client := &http.Client{Timeout: 3 * time.Second}
	return h.executeSnapshotCommand("Refresh Titles", func(nodes []bookmarks.Node) ([]bookmarks.Node, error) {
		successes := 0
		bookmarksToUpdate, err := collectBookmarksFromTree(nodes, ids)
		if err != nil {
			return nil, err
		}

		for _, node := range bookmarksToUpdate {
			title, fetchErr := fetchPageTitleWithClient(client, node.Bookmark.URL)
			if fetchErr != nil || title == "" || title == node.Bookmark.Title {
				continue
			}
			node.Bookmark.Title = title
			node.Bookmark.LastModified = time.Now()
			successes++
		}

		if successes == 0 {
			return nil, fmt.Errorf("failed to refresh titles for selected bookmarks")
		}

		return nodes, nil
	})
}

func (h *Handler) collectBookmarks(ids []string) ([]*bookmarks.Node, error) {
	return collectBookmarksFromTree(h.tree, ids)
}

func collectBookmarksFromTree(tree []bookmarks.Node, ids []string) ([]*bookmarks.Node, error) {
	result := make([]*bookmarks.Node, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))

	for _, id := range ids {
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}

		node := bookmarks.FindNode(tree, id)
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
	return h.saveTree(h.tree)
}

func (h *Handler) saveTree(tree []bookmarks.Node) error {
	if h.filePath == "" {
		return nil
	}
	output := bookmarks.Serialize(tree)
	if err := os.WriteFile(h.filePath, []byte(output), 0o644); err != nil {
		return fmt.Errorf("failed to save bookmarks: %w", err)
	}
	return nil
}

// FilePath returns the currently loaded file path.
func (h *Handler) FilePath() string {
	return h.filePath
}

// GetHistoryState returns whether undo/redo is currently available.
func (h *Handler) GetHistoryState() bookmarks.HistoryState {
	state := bookmarks.HistoryState{
		CanUndo: len(h.undoStack) > 0,
		CanRedo: len(h.redoStack) > 0,
	}
	if state.CanUndo {
		state.UndoLabel = h.undoStack[len(h.undoStack)-1].Label()
	}
	if state.CanRedo {
		state.RedoLabel = h.redoStack[len(h.redoStack)-1].Label()
	}
	return state
}

// Undo reverts the last undoable command.
func (h *Handler) Undo() (bookmarks.HistoryState, error) {
	if len(h.undoStack) == 0 {
		return h.GetHistoryState(), ErrNothingToUndo
	}

	command := h.undoStack[len(h.undoStack)-1]
	nextTree, err := command.Undo(h.tree)
	if err != nil {
		return h.GetHistoryState(), err
	}
	if err := h.saveTree(nextTree); err != nil {
		return h.GetHistoryState(), err
	}

	h.undoStack = h.undoStack[:len(h.undoStack)-1]
	h.redoStack = append(h.redoStack, command)
	h.tree = nextTree

	return h.GetHistoryState(), nil
}

// Redo reapplies the most recently undone command.
func (h *Handler) Redo() (bookmarks.HistoryState, error) {
	if len(h.redoStack) == 0 {
		return h.GetHistoryState(), ErrNothingToRedo
	}

	command := h.redoStack[len(h.redoStack)-1]
	nextTree, err := command.Apply(h.tree)
	if err != nil {
		return h.GetHistoryState(), err
	}
	if err := h.saveTree(nextTree); err != nil {
		return h.GetHistoryState(), err
	}

	h.redoStack = h.redoStack[:len(h.redoStack)-1]
	h.undoStack = append(h.undoStack, command)
	h.tree = nextTree

	return h.GetHistoryState(), nil
}

func loadNodesFromPath(path string) ([]bookmarks.Node, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	tree, err := bookmarks.Parse(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse bookmarks: %w", err)
	}

	return tree, nil
}

func (h *Handler) executeSnapshotCommand(label string, mutate func([]bookmarks.Node) ([]bookmarks.Node, error)) error {
	before := bookmarks.CloneTree(h.tree)
	working := bookmarks.CloneTree(h.tree)
	nextTree, err := mutate(working)
	if err != nil {
		return err
	}
	if nextTree == nil {
		nextTree = working
	}

	return h.commitSnapshotCommand(label, before, nextTree)
}

func (h *Handler) commitSnapshotCommand(label string, before []bookmarks.Node, after []bookmarks.Node) error {
	if err := h.saveTree(after); err != nil {
		return err
	}

	h.tree = bookmarks.CloneTree(after)
	h.undoStack = append(h.undoStack, bookmarks.NewSnapshotCommand(label, before, after))
	h.redoStack = nil
	return nil
}

func (h *Handler) clearHistory() {
	h.undoStack = nil
	h.redoStack = nil
}

func collectNodeIDs(nodes []bookmarks.Node) map[string]struct{} {
	ids := make(map[string]struct{})
	var visit func([]bookmarks.Node)
	visit = func(tree []bookmarks.Node) {
		for _, node := range tree {
			ids[node.ID()] = struct{}{}
			if node.Type == bookmarks.TypeFolder && node.Folder != nil {
				visit(node.Folder.Children)
			}
		}
	}
	visit(nodes)
	return ids
}

func findNewNodeID(nodes []bookmarks.Node, existingIDs map[string]struct{}) string {
	var visit func([]bookmarks.Node) string
	visit = func(tree []bookmarks.Node) string {
		for _, node := range tree {
			if _, exists := existingIDs[node.ID()]; !exists {
				return node.ID()
			}
			if node.Type == bookmarks.TypeFolder && node.Folder != nil {
				if childID := visit(node.Folder.Children); childID != "" {
					return childID
				}
			}
		}
		return ""
	}

	return visit(nodes)
}
