package bookmarks

import (
	"errors"
	"time"
)

var (
	ErrNotFound      = errors.New("node not found")
	ErrCircularMove  = errors.New("cannot move folder into its own descendant")
	ErrInvalidTarget = errors.New("cannot move into a bookmark (only folders)")
	ErrNoOpMove      = errors.New("move would not change location")
)

// FindNode locates a node by ID anywhere in the tree.
func FindNode(nodes []Node, id string) *Node {
	for i := range nodes {
		if nodes[i].ID() == id {
			return &nodes[i]
		}
		if nodes[i].Type == TypeFolder {
			if found := FindNode(nodes[i].Folder.Children, id); found != nil {
				return found
			}
		}
	}
	return nil
}

// FindParent locates the parent folder that contains the given child ID.
// Returns nil if the child is at the root level or not found.
func FindParent(nodes []Node, childID string) *Node {
	for i := range nodes {
		if nodes[i].Type == TypeFolder {
			for j := range nodes[i].Folder.Children {
				if nodes[i].Folder.Children[j].ID() == childID {
					return &nodes[i]
				}
			}
			if found := FindParent(nodes[i].Folder.Children, childID); found != nil {
				return found
			}
		}
	}
	return nil
}

// AddBookmark appends a bookmark to a folder.
func AddBookmark(nodes []Node, parentID string, bm Bookmark) ([]Node, error) {
	if parentID == "" {
		bm.ID = GenerateID()
		if bm.AddDate.IsZero() {
			bm.AddDate = time.Now()
		}
		bm.LastModified = time.Now()
		return append(nodes, Node{
			Type:     TypeBookmark,
			Bookmark: &bm,
		}), nil
	}

	parent := FindNode(nodes, parentID)
	if parent == nil {
		return nodes, ErrNotFound
	}
	if parent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}
	bm.ID = GenerateID()
	if bm.AddDate.IsZero() {
		bm.AddDate = time.Now()
	}
	bm.LastModified = time.Now()
	parent.Folder.Children = append(parent.Folder.Children, Node{
		Type:     TypeBookmark,
		Bookmark: &bm,
	})
	return nodes, nil
}

// AddFolder creates a new empty folder inside a parent folder.
func AddFolder(nodes []Node, parentID string, name string) ([]Node, error) {
	if parentID == "" {
		folder := &Folder{
			ID:           GenerateID(),
			Name:         name,
			AddDate:      time.Now(),
			LastModified: time.Now(),
			Children:     []Node{},
		}
		return append(nodes, Node{
			Type:   TypeFolder,
			Folder: folder,
		}), nil
	}

	parent := FindNode(nodes, parentID)
	if parent == nil {
		return nodes, ErrNotFound
	}
	if parent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}
	folder := &Folder{
		ID:           GenerateID(),
		Name:         name,
		AddDate:      time.Now(),
		LastModified: time.Now(),
		Children:     []Node{},
	}
	parent.Folder.Children = append(parent.Folder.Children, Node{
		Type:   TypeFolder,
		Folder: folder,
	})
	return nodes, nil
}

// UpdateBookmark modifies an existing bookmark's fields.
func UpdateBookmark(nodes []Node, id string, patch BookmarkPatch) error {
	node := FindNode(nodes, id)
	if node == nil {
		return ErrNotFound
	}
	if node.Type != TypeBookmark {
		return errors.New("node is not a bookmark")
	}
	if patch.Title != nil {
		node.Bookmark.Title = *patch.Title
	}
	if patch.URL != nil {
		node.Bookmark.URL = *patch.URL
	}
	if patch.Icon != nil {
		node.Bookmark.Icon = *patch.Icon
	}
	if patch.IconURI != nil {
		node.Bookmark.IconURI = *patch.IconURI
	}
	if patch.Meta != nil {
		node.Bookmark.Meta = *patch.Meta
	}
	node.Bookmark.LastModified = time.Now()
	return nil
}

// UpdateFolderName renames a folder.
func UpdateFolderName(nodes []Node, id string, name string) error {
	node := FindNode(nodes, id)
	if node == nil {
		return ErrNotFound
	}
	if node.Type != TypeFolder {
		return errors.New("node is not a folder")
	}
	node.Folder.Name = name
	node.Folder.LastModified = time.Now()
	return nil
}

// DeleteNode removes a node from the tree by ID.
func DeleteNode(nodes []Node, id string) ([]Node, error) {
	parent := FindParent(nodes, id)
	if parent == nil {
		// Root-level node
		exists := false
		for _, n := range nodes {
			if n.ID() == id {
				exists = true
				break
			}
		}
		if !exists {
			return nodes, ErrNotFound
		}
		return deleteFromSlice(nodes, id), nil
	}
	children := &parent.Folder.Children
	*children = deleteFromSlice(*children, id)
	return nodes, nil
}

// DeleteNodes removes multiple nodes from the same parent while preserving the order
// of the remaining siblings.
func DeleteNodes(nodes []Node, ids []string) ([]Node, error) {
	if len(ids) == 0 {
		return nodes, nil
	}

	idSet := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if id == "" {
			return nodes, ErrNotFound
		}
		if _, exists := idSet[id]; exists {
			continue
		}
		if FindNode(nodes, id) == nil {
			return nodes, ErrNotFound
		}
		idSet[id] = struct{}{}
	}

	parent := FindParent(nodes, ids[0])
	for _, id := range ids[1:] {
		candidateParent := FindParent(nodes, id)
		if parent == nil && candidateParent == nil {
			continue
		}
		if parent == nil || candidateParent == nil || parent.ID() != candidateParent.ID() {
			return nodes, ErrInvalidTarget
		}
	}

	if parent == nil {
		return filterOutNodes(nodes, idSet), nil
	}

	parent.Folder.Children = filterOutNodes(parent.Folder.Children, idSet)
	return nodes, nil
}

// deleteFromSlice removes a node with the given ID from a slice,
// searching recursively into sub-folders.
func deleteFromSlice(nodes []Node, id string) []Node {
	for i := range nodes {
		if nodes[i].ID() == id {
			return append(nodes[:i], nodes[i+1:]...)
		}
		if nodes[i].Type == TypeFolder {
			nodes[i].Folder.Children = deleteFromSlice(nodes[i].Folder.Children, id)
		}
	}
	return nodes
}

func filterOutNodes(nodes []Node, ids map[string]struct{}) []Node {
	result := make([]Node, 0, len(nodes))
	for _, node := range nodes {
		if _, remove := ids[node.ID()]; remove {
			continue
		}
		result = append(result, node)
	}
	return result
}

// IsDescendant checks whether descendantID is a descendant of ancestorID.
func IsDescendant(nodes []Node, ancestorID, descendantID string) bool {
	ancestor := FindNode(nodes, ancestorID)
	if ancestor == nil {
		return false
	}
	if ancestor.Type != TypeFolder {
		return false
	}
	return isDescendantInChildren(ancestor.Folder.Children, descendantID)
}

func isDescendantInChildren(children []Node, targetID string) bool {
	for i := range children {
		if children[i].ID() == targetID {
			return true
		}
		if children[i].Type == TypeFolder {
			if isDescendantInChildren(children[i].Folder.Children, targetID) {
				return true
			}
		}
	}
	return false
}

// MoveNode moves a node to a new parent folder at a specific index position.
func MoveNode(nodes []Node, nodeID, newParentID string, newIndex int) ([]Node, error) {
	// Cannot move into self
	if nodeID == newParentID {
		return nodes, ErrCircularMove
	}

	node := FindNode(nodes, nodeID)
	if node == nil {
		return nodes, ErrNotFound
	}

	// Cannot move folder into its own descendant
	if node.Type == TypeFolder && IsDescendant(nodes, nodeID, newParentID) {
		return nodes, ErrCircularMove
	}

	oldParent := FindParent(nodes, nodeID)
	oldIndex := -1
	movingFromRoot := oldParent == nil
	requestedIndex := newIndex

	// Remove from current location
	var removed Node
	if oldParent == nil {
		// Root-level node
		for i := range nodes {
			if nodes[i].ID() == nodeID {
				oldIndex = i
				removed = nodes[i]
				nodes = append(nodes[:i], nodes[i+1:]...)
				break
			}
		}
	} else {
		children := &oldParent.Folder.Children
		for i := range *children {
			if (*children)[i].ID() == nodeID {
				oldIndex = i
				removed = (*children)[i]
				*children = append((*children)[:i], (*children)[i+1:]...)
				break
			}
		}
	}

	if newParentID == "" {
		if movingFromRoot && oldIndex >= 0 && requestedIndex > oldIndex {
			newIndex--
		}

		if newIndex < 0 || newIndex > len(nodes) {
			newIndex = len(nodes)
		}

		nodes = append(nodes, Node{})
		copy(nodes[newIndex+1:], nodes[newIndex:])
		nodes[newIndex] = removed
		return nodes, nil
	}

	// Insert into new parent at index
	newParent := FindNode(nodes, newParentID)
	if newParent == nil {
		return nodes, ErrNotFound
	}
	if newParent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}

	children := newParent.Folder.Children
	if newIndex < 0 || newIndex > len(children) {
		newIndex = len(children)
	}

	// When reordering within the same folder, removing the item first shifts
	// later indices left by one.
	if oldParent != nil && oldParent.ID() == newParentID && oldIndex >= 0 && oldIndex < newIndex {
		newIndex--
	}

	children = append(children, Node{})
	copy(children[newIndex+1:], children[newIndex:])
	children[newIndex] = removed
	newParent.Folder.Children = children

	return nodes, nil
}

// MoveNodes moves multiple sibling nodes into a new folder while preserving their order.
func MoveNodes(nodes []Node, nodeIDs []string, newParentID string) ([]Node, error) {
	if len(nodeIDs) == 0 {
		return nodes, nil
	}

	newParent := FindNode(nodes, newParentID)
	if newParent == nil {
		return nodes, ErrNotFound
	}
	if newParent.Type != TypeFolder {
		return nodes, ErrInvalidTarget
	}

	seen := make(map[string]struct{}, len(nodeIDs))
	var firstParent *Node
	var moved []Node
	for _, nodeID := range nodeIDs {
		if nodeID == "" {
			return nodes, ErrNotFound
		}
		if _, exists := seen[nodeID]; exists {
			continue
		}
		seen[nodeID] = struct{}{}
		if nodeID == newParentID {
			return nodes, ErrCircularMove
		}

		node := FindNode(nodes, nodeID)
		if node == nil {
			return nodes, ErrNotFound
		}
		if node.Type == TypeFolder && IsDescendant(nodes, nodeID, newParentID) {
			return nodes, ErrCircularMove
		}

		parent := FindParent(nodes, nodeID)
		if firstParent == nil {
			firstParent = parent
		} else if !sameParent(firstParent, parent) {
			return nodes, ErrInvalidTarget
		}

		moved = append(moved, *node)
	}

	if sameParentID(firstParent, newParentID) {
		return nodes, ErrNoOpMove
	}

	if firstParent == nil {
		nodes = filterOutNodes(nodes, seen)
	} else {
		firstParent.Folder.Children = filterOutNodes(firstParent.Folder.Children, seen)
	}

	newParent.Folder.Children = append(newParent.Folder.Children, moved...)
	return nodes, nil
}

func sameParent(a, b *Node) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.ID() == b.ID()
}

func sameParentID(parent *Node, newParentID string) bool {
	if parent == nil {
		return newParentID == ""
	}
	return parent.ID() == newParentID
}

// BookmarkIndexEntry holds a flattened bookmark for search indexing.
type BookmarkIndexEntry struct {
	NodeID     string `json:"nodeId"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	FolderPath string `json:"folderPath"`
}

// BuildFlatIndex creates a flat list of all bookmarks with their folder paths for search.
func BuildFlatIndex(nodes []Node) []BookmarkIndexEntry {
	return buildFlatIndexRecursive(nodes, "")
}

func buildFlatIndexRecursive(nodes []Node, path string) []BookmarkIndexEntry {
	var result []BookmarkIndexEntry
	for i := range nodes {
		if nodes[i].Type == TypeBookmark {
			result = append(result, BookmarkIndexEntry{
				NodeID:     nodes[i].ID(),
				Title:      nodes[i].Bookmark.Title,
				URL:        nodes[i].Bookmark.URL,
				FolderPath: path,
			})
		} else {
			newPath := path
			if newPath == "" {
				newPath = nodes[i].Folder.Name
			} else {
				newPath = path + " / " + nodes[i].Folder.Name
			}
			result = append(result, buildFlatIndexRecursive(nodes[i].Folder.Children, newPath)...)
		}
	}
	return result
}
