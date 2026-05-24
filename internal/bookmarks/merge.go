package bookmarks

import (
	"fmt"
	"slices"
	"strings"
)

// MergePreview summarizes what an import would add or skip.
type MergePreview struct {
	FoldersToAdd       []FolderMergeItem      `json:"foldersToAdd"`
	BookmarksToAdd     []BookmarkMergeItem    `json:"bookmarksToAdd"`
	DuplicateBookmarks []BookmarkMergeItem    `json:"duplicateBookmarks"`
	PotentialUpdates   []BookmarkConflictItem `json:"potentialUpdates"`
}

// FolderMergeItem describes a folder that would be created.
type FolderMergeItem struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

// BookmarkMergeItem describes a bookmark involved in a merge report.
type BookmarkMergeItem struct {
	FolderPath string `json:"folderPath"`
	Title      string `json:"title"`
	URL        string `json:"url"`
}

// BookmarkConflictItem describes an incoming bookmark that looks like an update.
type BookmarkConflictItem struct {
	FolderPath    string `json:"folderPath"`
	ExistingTitle string `json:"existingTitle"`
	IncomingTitle string `json:"incomingTitle"`
	URL           string `json:"url"`
	ExistingMeta  string `json:"existingMeta"`
	IncomingMeta  string `json:"incomingMeta"`
}

// MergeApplyResult summarizes an applied merge.
type MergeApplyResult struct {
	FoldersAdded      int `json:"foldersAdded"`
	BookmarksAdded    int `json:"bookmarksAdded"`
	DuplicatesSkipped int `json:"duplicatesSkipped"`
	PotentialUpdates  int `json:"potentialUpdates"`
}

// PreviewMerge computes an additive merge preview without mutating the tree.
func PreviewMerge(existing []Node, incoming []Node) (MergePreview, error) {
	preview := MergePreview{
		FoldersToAdd:       []FolderMergeItem{},
		BookmarksToAdd:     []BookmarkMergeItem{},
		DuplicateBookmarks: []BookmarkMergeItem{},
		PotentialUpdates:   []BookmarkConflictItem{},
	}

	previewNodes(existing, incoming, nil, &preview)
	sortMergePreview(&preview)

	return preview, nil
}

// ApplyMerge performs an additive merge and returns the updated tree plus counts.
func ApplyMerge(existing []Node, incoming []Node) ([]Node, MergeApplyResult, error) {
	result := MergeApplyResult{}
	mergeNodes(&existing, incoming, &result)
	return existing, result, nil
}

func previewNodes(existing []Node, incoming []Node, path []string, preview *MergePreview) {
	for _, node := range incoming {
		switch node.Type {
		case TypeFolder:
			if node.Folder == nil {
				continue
			}

			nextPath := appendPath(path, node.Folder.Name)
			existingFolder := findFolderByName(existing, node.Folder.Name)
			if existingFolder == nil {
				collectFolderAdds(node.Folder, path, preview)
				continue
			}

			previewNodes(existingFolder.Children, node.Folder.Children, nextPath, preview)
		case TypeBookmark:
			if node.Bookmark == nil {
				continue
			}

			item := BookmarkMergeItem{
				FolderPath: formatFolderPath(path),
				Title:      node.Bookmark.Title,
				URL:        node.Bookmark.URL,
			}

			matchType, existingBookmark := classifyBookmark(existing, node.Bookmark)
			switch matchType {
			case mergeMatchDuplicate:
				preview.DuplicateBookmarks = append(preview.DuplicateBookmarks, item)
			case mergeMatchPotentialUpdate:
				preview.PotentialUpdates = append(preview.PotentialUpdates, BookmarkConflictItem{
					FolderPath:    formatFolderPath(path),
					ExistingTitle: existingBookmark.Title,
					IncomingTitle: node.Bookmark.Title,
					URL:           node.Bookmark.URL,
					ExistingMeta:  existingBookmark.Meta,
					IncomingMeta:  node.Bookmark.Meta,
				})
			default:
				preview.BookmarksToAdd = append(preview.BookmarksToAdd, item)
			}
		}
	}
}

func collectFolderAdds(folder *Folder, parentPath []string, preview *MergePreview) {
	if folder == nil {
		return
	}

	nextPath := appendPath(parentPath, folder.Name)
	preview.FoldersToAdd = append(preview.FoldersToAdd, FolderMergeItem{
		Path: formatFolderPath(nextPath),
		Name: folder.Name,
	})

	for _, child := range folder.Children {
		switch child.Type {
		case TypeFolder:
			collectFolderAdds(child.Folder, nextPath, preview)
		case TypeBookmark:
			if child.Bookmark == nil {
				continue
			}
			preview.BookmarksToAdd = append(preview.BookmarksToAdd, BookmarkMergeItem{
				FolderPath: formatFolderPath(nextPath),
				Title:      child.Bookmark.Title,
				URL:        child.Bookmark.URL,
			})
		}
	}
}

func mergeNodes(existing *[]Node, incoming []Node, result *MergeApplyResult) {
	for _, node := range incoming {
		switch node.Type {
		case TypeFolder:
			if node.Folder == nil {
				continue
			}

			existingFolder := findFolderByName(*existing, node.Folder.Name)
			if existingFolder == nil {
				cloned := cloneFolderForMerge(node.Folder)
				*existing = append(*existing, Node{Type: TypeFolder, Folder: cloned})
				result.FoldersAdded++
				existingFolder = cloned
			}

			mergeNodes(&existingFolder.Children, node.Folder.Children, result)
		case TypeBookmark:
			if node.Bookmark == nil {
				continue
			}

			matchType, _ := classifyBookmark(*existing, node.Bookmark)
			switch matchType {
			case mergeMatchDuplicate:
				result.DuplicatesSkipped++
			case mergeMatchPotentialUpdate:
				result.PotentialUpdates++
			default:
				cloned := cloneBookmarkForMerge(node.Bookmark)
				*existing = append(*existing, Node{Type: TypeBookmark, Bookmark: cloned})
				result.BookmarksAdded++
			}
		}
	}
}

type bookmarkMergeMatch int

const (
	mergeMatchNone bookmarkMergeMatch = iota
	mergeMatchDuplicate
	mergeMatchPotentialUpdate
)

func classifyBookmark(existing []Node, incoming *Bookmark) (bookmarkMergeMatch, *Bookmark) {
	if incoming == nil {
		return mergeMatchNone, nil
	}

	var sameURL *Bookmark
	for _, node := range existing {
		if node.Type != TypeBookmark || node.Bookmark == nil {
			continue
		}
		if node.Bookmark.URL != incoming.URL {
			continue
		}
		if bookmarksEqualForMerge(node.Bookmark, incoming) {
			return mergeMatchDuplicate, node.Bookmark
		}
		if sameURL == nil {
			sameURL = node.Bookmark
		}
	}

	if sameURL != nil {
		return mergeMatchPotentialUpdate, sameURL
	}

	return mergeMatchNone, nil
}

func bookmarksEqualForMerge(existing *Bookmark, incoming *Bookmark) bool {
	if existing == nil || incoming == nil {
		return false
	}

	return existing.URL == incoming.URL &&
		existing.Title == incoming.Title &&
		existing.Meta == incoming.Meta &&
		existing.Icon == incoming.Icon &&
		existing.IconURI == incoming.IconURI
}

func findFolderByName(nodes []Node, name string) *Folder {
	for _, node := range nodes {
		if node.Type == TypeFolder && node.Folder != nil && node.Folder.Name == name {
			return node.Folder
		}
	}
	return nil
}

func cloneFolderForMerge(folder *Folder) *Folder {
	if folder == nil {
		return nil
	}

	return &Folder{
		ID:           GenerateID(),
		Name:         folder.Name,
		Icon:         folder.Icon,
		AddDate:      folder.AddDate,
		LastModified: folder.LastModified,
		Meta:         folder.Meta,
		Children:     []Node{},
	}
}

func cloneBookmarkForMerge(bookmark *Bookmark) *Bookmark {
	if bookmark == nil {
		return nil
	}

	return &Bookmark{
		ID:           GenerateID(),
		Title:        bookmark.Title,
		URL:          bookmark.URL,
		Icon:         bookmark.Icon,
		IconURI:      bookmark.IconURI,
		AddDate:      bookmark.AddDate,
		LastModified: bookmark.LastModified,
		Meta:         bookmark.Meta,
	}
}

func appendPath(path []string, part string) []string {
	next := slices.Clone(path)
	next = append(next, part)
	return next
}

func formatFolderPath(path []string) string {
	return strings.Join(path, " / ")
}

func sortMergePreview(preview *MergePreview) {
	slices.SortFunc(preview.FoldersToAdd, func(a, b FolderMergeItem) int {
		return compareStrings(a.Path, b.Path)
	})
	slices.SortFunc(preview.BookmarksToAdd, func(a, b BookmarkMergeItem) int {
		return compareBookmarkItems(a, b)
	})
	slices.SortFunc(preview.DuplicateBookmarks, func(a, b BookmarkMergeItem) int {
		return compareBookmarkItems(a, b)
	})
	slices.SortFunc(preview.PotentialUpdates, func(a, b BookmarkConflictItem) int {
		if cmp := compareStrings(a.FolderPath, b.FolderPath); cmp != 0 {
			return cmp
		}
		if cmp := compareStrings(a.IncomingTitle, b.IncomingTitle); cmp != 0 {
			return cmp
		}
		return compareStrings(a.URL, b.URL)
	})
}

func compareBookmarkItems(a, b BookmarkMergeItem) int {
	if cmp := compareStrings(a.FolderPath, b.FolderPath); cmp != 0 {
		return cmp
	}
	if cmp := compareStrings(a.Title, b.Title); cmp != 0 {
		return cmp
	}
	return compareStrings(a.URL, b.URL)
}

func compareStrings(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	default:
		return 0
	}
}

func (p MergePreview) HasChanges() bool {
	return len(p.FoldersToAdd) > 0 || len(p.BookmarksToAdd) > 0
}

func (p MergePreview) String() string {
	return fmt.Sprintf("folders=%d bookmarks=%d duplicates=%d updates=%d",
		len(p.FoldersToAdd),
		len(p.BookmarksToAdd),
		len(p.DuplicateBookmarks),
		len(p.PotentialUpdates),
	)
}
