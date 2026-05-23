package bookmarks

import (
	"fmt"
	"time"
)

// NodeType distinguishes folders from bookmarks.
type NodeType int

const (
	TypeFolder   NodeType = iota
	TypeBookmark NodeType = iota
)

func (t NodeType) String() string {
	switch t {
	case TypeFolder:
		return "folder"
	case TypeBookmark:
		return "bookmark"
	default:
		return "unknown"
	}
}

// Bookmark represents a single bookmark entry.
type Bookmark struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	URL          string    `json:"url"`
	Icon         string    `json:"icon"`
	IconURI      string    `json:"iconURI"`
	AddDate      time.Time `json:"addDate"`
	LastModified time.Time `json:"lastModified"`
	Meta         string    `json:"meta"`
}

// Folder represents a bookmark folder that can contain children.
type Folder struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Icon         string    `json:"icon"`
	AddDate      time.Time `json:"addDate"`
	LastModified time.Time `json:"lastModified"`
	Meta         string    `json:"meta"`
	Children     []Node    `json:"children"`
}

// Node is a discriminated union of Folder or Bookmark.
type Node struct {
	Type     NodeType  `json:"type"`
	Folder   *Folder   `json:"folder"`
	Bookmark *Bookmark `json:"bookmark"`
}

// ID returns the node's ID regardless of type.
func (n *Node) ID() string {
	switch n.Type {
	case TypeFolder:
		return n.Folder.ID
	case TypeBookmark:
		return n.Bookmark.ID
	default:
		return ""
	}
}

// Name returns the display name (folder name or bookmark title).
func (n *Node) Name() string {
	switch n.Type {
	case TypeFolder:
		return n.Folder.Name
	case TypeBookmark:
		return n.Bookmark.Title
	default:
		return ""
	}
}

// Children returns child nodes (folders only, panics for bookmarks).
func (n *Node) Children() []Node {
	if n.Type != TypeFolder {
		panic(fmt.Sprintf("cannot get children of %s", n.Type))
	}
	return n.Folder.Children
}

// HasChildren returns whether the node has children (always true for folders, false for bookmarks).
func (n *Node) HasChildren() bool {
	if n.Type != TypeFolder {
		return false
	}
	return len(n.Folder.Children) > 0
}

// GenerateID creates a simple unique ID using a counter.
var idCounter int64

func GenerateID() string {
	idCounter++
	return fmt.Sprintf("node-%d", idCounter)
}
