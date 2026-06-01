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

// TreeStats holds aggregate counts for the bookmark tree.
type TreeStats struct {
	Folders   int `json:"folders"`
	Bookmarks int `json:"bookmarks"`
}

// GetTreeStats returns the total number of folders and bookmarks in the tree.
func (h *Handler) GetTreeStats() TreeStats {
	var folders, bookmarks int
	countNodes(h.tree, &folders, &bookmarks)
	return TreeStats{Folders: folders, Bookmarks: bookmarks}
}

func countNodes(nodes []bookmarks.Node, folders, bmCount *int) {
	for i := range nodes {
		if nodes[i].Type == bookmarks.TypeFolder {
			*folders++
			countNodes(nodes[i].Folder.Children, folders, bmCount)
		} else {
			*bmCount++
		}
	}
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

// AddBookmark adds a bookmark to a folder, auto-saves, and returns the created node.
// Uses AddCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) AddBookmark(parentID string, bm BookmarkCreateDTO) (bookmarks.FlatNode, error) {
	nextTree, createdNode, err := bookmarks.AddBookmarkWithCreated(h.tree, parentID, toBookmarkCreate(bm))
	if err != nil {
		return bookmarks.FlatNode{}, err
	}
	created := bookmarks.NewFlatNode(createdNode, parentID)
	if err := h.saveTree(nextTree); err != nil {
		return bookmarks.FlatNode{}, err
	}
	h.tree = nextTree
	h.undoStack = append(h.undoStack, bookmarks.NewAddCommand("Add Bookmark", parentID, createdNode))
	h.redoStack = nil
	return created, nil
}

// AddFolder adds a folder, auto-saves, and returns the created node.
// Uses AddCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) AddFolder(parentID string, name string) (bookmarks.FlatNode, error) {
	nextTree, createdNode, err := bookmarks.AddFolderWithCreated(h.tree, parentID, name)
	if err != nil {
		return bookmarks.FlatNode{}, err
	}
	created := bookmarks.NewFlatNode(createdNode, parentID)
	if err := h.saveTree(nextTree); err != nil {
		return bookmarks.FlatNode{}, err
	}
	h.tree = nextTree
	h.undoStack = append(h.undoStack, bookmarks.NewAddCommand("Add Folder", parentID, createdNode))
	h.redoStack = nil
	return created, nil
}

// UpdateBookmark updates a bookmark and auto-saves.
// Uses UpdateBookmarkCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) UpdateBookmark(id string, patch BookmarkPatchDTO) error {
	node := bookmarks.FindNode(h.tree, id)
	if node == nil {
		return bookmarks.ErrNotFound
	}
	if node.Type != bookmarks.TypeBookmark {
		return fmt.Errorf("node is not a bookmark")
	}

	// Capture old values before mutation
	oldBookmark := *node.Bookmark

	if err := bookmarks.UpdateBookmark(h.tree, id, toBookmarkPatch(patch)); err != nil {
		return err
	}

	// Capture new values after mutation
	newBookmark := *node.Bookmark

	if err := h.saveTree(h.tree); err != nil {
		// Rollback on save failure
		bookmarks.UpdateBookmark(h.tree, id, bookmarks.BookmarkPatch{
			Title:   &oldBookmark.Title,
			URL:     &oldBookmark.URL,
			Icon:    &oldBookmark.Icon,
			IconURI: &oldBookmark.IconURI,
			Meta:    &oldBookmark.Meta,
		})
		return err
	}

	h.undoStack = append(h.undoStack, bookmarks.NewUpdateBookmarkCommand("Edit Bookmark", id, oldBookmark, newBookmark))
	h.redoStack = nil
	return nil
}

// UpdateFolderName renames a folder and auto-saves.
// Uses UpdateFolderNameCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) UpdateFolderName(id string, name string) error {
	node := bookmarks.FindNode(h.tree, id)
	if node == nil {
		return bookmarks.ErrNotFound
	}
	if node.Type != bookmarks.TypeFolder {
		return fmt.Errorf("node is not a folder")
	}

	// Capture old name before mutation
	oldName := node.Folder.Name
	node.Folder.Name = name
	node.Folder.LastModified = time.Now()

	if err := h.saveTree(h.tree); err != nil {
		// Rollback on save failure
		node.Folder.Name = oldName
		return err
	}

	h.undoStack = append(h.undoStack, bookmarks.NewUpdateFolderNameCommand("Rename Folder", id, oldName, name))
	h.redoStack = nil
	return nil
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

// MoveNode moves a node, auto-saves, and returns metadata for targeted frontend patching.
// Uses MoveCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) MoveNode(nodeID, newParentID string, newIndex int) (MoveResult, error) {
	label := "Move Bookmark"
	if node := bookmarks.FindNode(h.tree, nodeID); node != nil && node.Type == bookmarks.TypeFolder {
		label = "Move Folder"
	}

	// Capture old location before the move
	oldParentID := parentIDForNode(h.tree, nodeID)
	oldIndex := childIndexInParent(h.tree, oldParentID, nodeID)

	nextTree, err := bookmarks.MoveNode(h.tree, nodeID, newParentID, newIndex)
	if err != nil {
		return MoveResult{}, err
	}

	if err := h.saveTree(nextTree); err != nil {
		return MoveResult{}, err
	}
	h.tree = nextTree
	h.undoStack = append(h.undoStack, bookmarks.NewMoveCommand(label, nodeID, oldParentID, oldIndex, newParentID, newIndex))
	h.redoStack = nil

	result := buildMoveResult(h.tree, []string{nodeID}, oldParentID, newParentID)
	return result, nil
}

// MoveNodes moves multiple nodes, auto-saves once, and returns metadata for targeted frontend patching.
// Uses MultiMoveCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) MoveNodes(nodeIDs []string, targetFolderID string) (MoveResult, error) {
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

	// Capture old location before the move
	oldParentID := ""
	if len(nodeIDs) > 0 {
		oldParentID = parentIDForNode(h.tree, nodeIDs[0])
	}

	nextTree, err := bookmarks.MoveNodes(h.tree, nodeIDs, targetFolderID)
	if err != nil {
		return MoveResult{}, err
	}

	if err := h.saveTree(nextTree); err != nil {
		return MoveResult{}, err
	}
	h.tree = nextTree
	h.undoStack = append(h.undoStack, bookmarks.NewMultiMoveCommand(label, nodeIDs, oldParentID, targetFolderID))
	h.redoStack = nil

	result := buildMoveResult(h.tree, nodeIDs, oldParentID, targetFolderID)
	return result, nil
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

// FetchFaviconsForNodes refreshes bookmark favicons, saves once at the end,
// and returns the updated nodes for targeted frontend patching.
// Uses UpdateBookmarkCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) FetchFaviconsForNodes(ids []string) ([]bookmarks.FlatNode, error) {
	client := &http.Client{Timeout: 5 * time.Second}

	bookmarksToUpdate, err := collectBookmarksFromTree(h.tree, ids)
	if err != nil {
		return nil, err
	}

	// Capture old values before mutation
	olds := make([]bookmarks.Bookmark, len(bookmarksToUpdate))
	for i, node := range bookmarksToUpdate {
		olds[i] = *node.Bookmark
	}

	var updated []bookmarks.FlatNode
	successes := 0
	for _, node := range bookmarksToUpdate {
		icon, fetchErr := fetchFaviconWithClient(client, node.Bookmark.URL)
		if fetchErr != nil || icon == "" || icon == node.Bookmark.Icon {
			continue
		}
		node.Bookmark.Icon = icon
		node.Bookmark.LastModified = time.Now()
		updated = append(updated, bookmarks.NewFlatNode(*node, ""))
		successes++
	}

	if successes == 0 {
		return nil, fmt.Errorf("failed to fetch favicons for selected bookmarks")
	}

	if err := h.saveTree(h.tree); err != nil {
		// Rollback on save failure
		for i, node := range bookmarksToUpdate {
			if node.Bookmark.Icon != olds[i].Icon {
				node.Bookmark.Icon = olds[i].Icon
			}
		}
		return updated, err
	}

	// Push one undo command per changed bookmark
	h.redoStack = nil
	for i, node := range bookmarksToUpdate {
		if node.Bookmark.Icon != olds[i].Icon {
			h.undoStack = append(h.undoStack, bookmarks.NewUpdateBookmarkCommand(
				"Refresh Favicons", node.ID(), olds[i], *node.Bookmark))
		}
	}

	return updated, nil
}

// RefreshTitlesForNodes refreshes bookmark titles, saves once at the end,
// and returns the updated nodes for targeted frontend patching.
// Uses UpdateBookmarkCommand for lightweight undo (no full-tree snapshot clone).
func (h *Handler) RefreshTitlesForNodes(ids []string) ([]bookmarks.FlatNode, error) {
	client := &http.Client{Timeout: 3 * time.Second}

	bookmarksToUpdate, err := collectBookmarksFromTree(h.tree, ids)
	if err != nil {
		return nil, err
	}

	// Capture old values before mutation
	olds := make([]bookmarks.Bookmark, len(bookmarksToUpdate))
	for i, node := range bookmarksToUpdate {
		olds[i] = *node.Bookmark
	}

	var updated []bookmarks.FlatNode
	successes := 0
	for _, node := range bookmarksToUpdate {
		title, fetchErr := fetchPageTitleWithClient(client, node.Bookmark.URL)
		if fetchErr != nil || title == "" || title == node.Bookmark.Title {
			continue
		}
		node.Bookmark.Title = title
		node.Bookmark.LastModified = time.Now()
		updated = append(updated, bookmarks.NewFlatNode(*node, ""))
		successes++
	}

	if successes == 0 {
		return nil, fmt.Errorf("failed to refresh titles for selected bookmarks")
	}

	if err := h.saveTree(h.tree); err != nil {
		// Rollback on save failure
		for i, node := range bookmarksToUpdate {
			if node.Bookmark.Title != olds[i].Title {
				node.Bookmark.Title = olds[i].Title
			}
		}
		return updated, err
	}

	// Push one undo command per changed bookmark
	h.redoStack = nil
	for i, node := range bookmarksToUpdate {
		if node.Bookmark.Title != olds[i].Title {
			h.undoStack = append(h.undoStack, bookmarks.NewUpdateBookmarkCommand(
				"Refresh Titles", node.ID(), olds[i], *node.Bookmark))
		}
	}

	return updated, nil
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

func parentIDForNode(nodes []bookmarks.Node, nodeID string) string {
	parent := bookmarks.FindParent(nodes, nodeID)
	if parent == nil {
		return ""
	}
	return parent.ID()
}

func childIndexInParent(nodes []bookmarks.Node, parentID string, nodeID string) int {
	children := nodes
	if parentID != "" {
		parent := bookmarks.FindFolder(nodes, parentID)
		if parent == nil {
			return -1
		}
		children = parent.Folder.Children
	}

	for index := range children {
		if children[index].ID() == nodeID {
			return index
		}
	}
	return -1
}

func buildMoveResult(nodes []bookmarks.Node, nodeIDs []string, oldParentID string, fallbackNewParentID string) MoveResult {
	result := MoveResult{
		OldParentID: oldParentID,
		NewParentID: fallbackNewParentID,
		NewIndex:    -1,
	}

	for _, nodeID := range nodeIDs {
		node := bookmarks.FindNode(nodes, nodeID)
		if node == nil {
			continue
		}

		parentID := parentIDForNode(nodes, nodeID)
		if len(result.MovedNodes) == 0 {
			result.NewParentID = parentID
			result.NewIndex = childIndexInParent(nodes, parentID, nodeID)
		}
		result.MovedNodes = append(result.MovedNodes, bookmarks.NewFlatNode(*node, parentID))
	}

	return result
}
