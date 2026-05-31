package bookmarks

import "time"

// FlattenTree produces a flat list of nodes from a nested tree.
// Uses an explicit stack to avoid recursion depth issues with deeply nested trees.
// Root-level nodes have an empty ParentID.
func FlattenTree(nodes []Node) []FlatNode {
	if len(nodes) == 0 {
		return nil
	}

	result := make([]FlatNode, 0, len(nodes))

	type stackEntry struct {
		childNodes []Node
		parentID   string
	}

	stack := []stackEntry{{childNodes: nodes, parentID: ""}}

	for len(stack) > 0 {
		entry := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		for _, node := range entry.childNodes {
			dto := FlatNode{
				ID:       node.ID(),
				Type:     node.Type,
				ParentID: entry.parentID,
			}

			switch node.Type {
			case TypeFolder:
				dto.Name = node.Folder.Name
				dto.ChildCount = len(node.Folder.Children)
				dto.AddDate = formatFlatTime(node.Folder.AddDate)
				dto.LastModified = formatFlatTime(node.Folder.LastModified)
				dto.Icon = node.Folder.Icon
				dto.Meta = node.Folder.Meta

				result = append(result, dto)

				if len(node.Folder.Children) > 0 {
					stack = append(stack, stackEntry{
						childNodes: node.Folder.Children,
						parentID:   node.Folder.ID,
					})
				}

			case TypeBookmark:
				dto.Name = node.Bookmark.Title
				dto.URL = node.Bookmark.URL
				dto.Icon = node.Bookmark.Icon
				dto.IconURI = node.Bookmark.IconURI
				dto.Meta = node.Bookmark.Meta
				dto.AddDate = formatFlatTime(node.Bookmark.AddDate)
				dto.LastModified = formatFlatTime(node.Bookmark.LastModified)

				result = append(result, dto)
			}
		}
	}

	return result
}

func formatFlatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

// NewFlatNode creates a FlatNode from a Node with the given parentID.
// Unlike FlattenTree, this only converts a single node (no recursion).
func NewFlatNode(node Node, parentID string) FlatNode {
	dto := FlatNode{
		ID:       node.ID(),
		Type:     node.Type,
		ParentID: parentID,
	}

	switch node.Type {
	case TypeFolder:
		dto.Name = node.Folder.Name
		dto.ChildCount = len(node.Folder.Children)
		dto.AddDate = formatFlatTime(node.Folder.AddDate)
		dto.LastModified = formatFlatTime(node.Folder.LastModified)
		dto.Icon = node.Folder.Icon
		dto.Meta = node.Folder.Meta
	case TypeBookmark:
		dto.Name = node.Bookmark.Title
		dto.URL = node.Bookmark.URL
		dto.Icon = node.Bookmark.Icon
		dto.IconURI = node.Bookmark.IconURI
		dto.Meta = node.Bookmark.Meta
		dto.AddDate = formatFlatTime(node.Bookmark.AddDate)
		dto.LastModified = formatFlatTime(node.Bookmark.LastModified)
	}

	return dto
}
