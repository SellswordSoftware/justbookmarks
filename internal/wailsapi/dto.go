package wailsapi

import (
	"time"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
)

type BookmarkDTO struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	URL          string `json:"url"`
	Icon         string `json:"icon"`
	IconURI      string `json:"iconURI"`
	AddDate      string `json:"addDate"`
	LastModified string `json:"lastModified"`
	Meta         string `json:"meta"`
}

type BookmarkCreateDTO struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Icon    string `json:"icon"`
	IconURI string `json:"iconURI"`
	Meta    string `json:"meta"`
}

type BookmarkPatchDTO struct {
	Title   *string `json:"title,omitempty"`
	URL     *string `json:"url,omitempty"`
	Icon    *string `json:"icon,omitempty"`
	IconURI *string `json:"iconURI,omitempty"`
	Meta    *string `json:"meta,omitempty"`
}

type FolderDTO struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Icon         string    `json:"icon"`
	AddDate      string    `json:"addDate"`
	LastModified string    `json:"lastModified"`
	Meta         string    `json:"meta"`
	Children     []NodeDTO `json:"children"`
}

type NodeDTO struct {
	ID       string             `json:"id"`
	Type     bookmarks.NodeType `json:"type"`
	Folder   *FolderDTO         `json:"folder"`
	Bookmark *BookmarkDTO       `json:"bookmark"`
}

type MoveResult struct {
	MovedNodes  []bookmarks.FlatNode `json:"movedNodes"`
	OldParentID string               `json:"oldParentId"`
	NewParentID string               `json:"newParentId"`
	NewIndex    int                  `json:"newIndex"`
}

func toNodeDTOs(nodes []bookmarks.Node) []NodeDTO {
	result := make([]NodeDTO, 0, len(nodes))
	for _, node := range nodes {
		result = append(result, toNodeDTO(node))
	}
	return result
}

func toNodeDTO(node bookmarks.Node) NodeDTO {
	dto := NodeDTO{
		ID:   node.ID(),
		Type: node.Type,
	}

	if node.Folder != nil {
		dto.Folder = &FolderDTO{
			ID:           node.Folder.ID,
			Name:         node.Folder.Name,
			Icon:         node.Folder.Icon,
			AddDate:      formatTimestamp(node.Folder.AddDate),
			LastModified: formatTimestamp(node.Folder.LastModified),
			Meta:         node.Folder.Meta,
			Children:     toNodeDTOs(node.Folder.Children),
		}
	}

	if node.Bookmark != nil {
		dto.Bookmark = &BookmarkDTO{
			ID:           node.Bookmark.ID,
			Title:        node.Bookmark.Title,
			URL:          node.Bookmark.URL,
			Icon:         node.Bookmark.Icon,
			IconURI:      node.Bookmark.IconURI,
			AddDate:      formatTimestamp(node.Bookmark.AddDate),
			LastModified: formatTimestamp(node.Bookmark.LastModified),
			Meta:         node.Bookmark.Meta,
		}
	}

	return dto
}

func toBookmarkCreate(dto BookmarkCreateDTO) bookmarks.Bookmark {
	return bookmarks.Bookmark{
		Title:   dto.Title,
		URL:     dto.URL,
		Icon:    dto.Icon,
		IconURI: dto.IconURI,
		Meta:    dto.Meta,
	}
}

func toBookmarkPatch(dto BookmarkPatchDTO) bookmarks.BookmarkPatch {
	return bookmarks.BookmarkPatch{
		Title:   dto.Title,
		URL:     dto.URL,
		Icon:    dto.Icon,
		IconURI: dto.IconURI,
		Meta:    dto.Meta,
	}
}

func formatTimestamp(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}
