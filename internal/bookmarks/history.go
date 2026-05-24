package bookmarks

// Command represents a reversible tree mutation.
type Command interface {
	Label() string
	Apply(tree []Node) ([]Node, error)
	Undo(tree []Node) ([]Node, error)
}

// HistoryState reports whether undo/redo is currently available.
type HistoryState struct {
	CanUndo   bool   `json:"canUndo"`
	CanRedo   bool   `json:"canRedo"`
	UndoLabel string `json:"undoLabel"`
	RedoLabel string `json:"redoLabel"`
}

// SnapshotCommand replays a mutation by swapping the full tree snapshot.
type SnapshotCommand struct {
	label  string
	before []Node
	after  []Node
}

// NewSnapshotCommand creates a reversible command from full-tree snapshots.
func NewSnapshotCommand(label string, before []Node, after []Node) SnapshotCommand {
	return SnapshotCommand{
		label:  label,
		before: CloneTree(before),
		after:  CloneTree(after),
	}
}

func (c SnapshotCommand) Label() string {
	return c.label
}

func (c SnapshotCommand) Apply(tree []Node) ([]Node, error) {
	return CloneTree(c.after), nil
}

func (c SnapshotCommand) Undo(tree []Node) ([]Node, error) {
	return CloneTree(c.before), nil
}

// CloneTree deep-copies a bookmark tree so history snapshots are immutable.
func CloneTree(nodes []Node) []Node {
	if len(nodes) == 0 {
		return []Node{}
	}

	cloned := make([]Node, len(nodes))
	for i := range nodes {
		cloned[i] = CloneNode(nodes[i])
	}
	return cloned
}

// CloneNode deep-copies a single node.
func CloneNode(node Node) Node {
	cloned := Node{Type: node.Type}
	if node.Folder != nil {
		folder := CloneFolder(*node.Folder)
		cloned.Folder = &folder
	}
	if node.Bookmark != nil {
		bookmark := CloneBookmark(*node.Bookmark)
		cloned.Bookmark = &bookmark
	}
	return cloned
}

// CloneFolder deep-copies a folder and its descendants.
func CloneFolder(folder Folder) Folder {
	return Folder{
		ID:           folder.ID,
		Name:         folder.Name,
		Icon:         folder.Icon,
		AddDate:      folder.AddDate,
		LastModified: folder.LastModified,
		Meta:         folder.Meta,
		Children:     CloneTree(folder.Children),
	}
}

// CloneBookmark deep-copies a bookmark.
func CloneBookmark(bookmark Bookmark) Bookmark {
	return Bookmark{
		ID:           bookmark.ID,
		Title:        bookmark.Title,
		URL:          bookmark.URL,
		Icon:         bookmark.Icon,
		IconURI:      bookmark.IconURI,
		AddDate:      bookmark.AddDate,
		LastModified: bookmark.LastModified,
		Meta:         bookmark.Meta,
	}
}
