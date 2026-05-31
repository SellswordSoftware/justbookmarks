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

// AddCommand is a lightweight undoable command for add bookmark/folder operations.
// Stores only the created node and its parent ID instead of full-tree snapshots.
type AddCommand struct {
	label    string
	parentID string
	node     Node
}

// NewAddCommand creates an add command that can undo by deleting the node
// and redo by re-adding it.
func NewAddCommand(label string, parentID string, node Node) AddCommand {
	return AddCommand{
		label:    label,
		parentID: parentID,
		node:     CloneNode(node),
	}
}

func (c AddCommand) Label() string {
	return c.label
}

// Apply re-adds the created node to its parent (or root).
func (c AddCommand) Apply(tree []Node) ([]Node, error) {
	if c.parentID == "" {
		return append(tree, c.node), nil
	}
	parent := FindNode(tree, c.parentID)
	if parent == nil || parent.Type != TypeFolder {
		return tree, ErrNotFound
	}
	parent.Folder.Children = append(parent.Folder.Children, c.node)
	return tree, nil
}

// Undo deletes the created node from the tree.
func (c AddCommand) Undo(tree []Node) ([]Node, error) {
	return DeleteNode(tree, c.node.ID())
}

// MoveCommand is a lightweight undoable command for move operations.
// Stores only the move parameters instead of full-tree snapshots.
type MoveCommand struct {
	label       string
	nodeID      string
	oldParentID string
	oldIndex    int
	newParentID string
	newIndex    int
}

// NewMoveCommand creates a move command that can undo by moving the node
// back to its original location and redo by re-applying the move.
func NewMoveCommand(label, nodeID, oldParentID string, oldIndex int, newParentID string, newIndex int) MoveCommand {
	return MoveCommand{
		label:       label,
		nodeID:      nodeID,
		oldParentID: oldParentID,
		oldIndex:    oldIndex,
		newParentID: newParentID,
		newIndex:    newIndex,
	}
}

func (c MoveCommand) Label() string {
	return c.label
}

// Apply moves the node to its new location.
func (c MoveCommand) Apply(tree []Node) ([]Node, error) {
	return MoveNode(tree, c.nodeID, c.newParentID, c.newIndex)
}

// Undo moves the node back to its original location.
func (c MoveCommand) Undo(tree []Node) ([]Node, error) {
	return MoveNode(tree, c.nodeID, c.oldParentID, c.oldIndex)
}

// MultiMoveCommand is a lightweight undoable command for multi-node move operations.
type MultiMoveCommand struct {
	label       string
	nodeIDs     []string
	oldParentID string
	newParentID string
}

// NewMultiMoveCommand creates a multi-move command.
func NewMultiMoveCommand(label string, nodeIDs []string, oldParentID, newParentID string) MultiMoveCommand {
	return MultiMoveCommand{
		label:       label,
		nodeIDs:     append([]string{}, nodeIDs...),
		oldParentID: oldParentID,
		newParentID: newParentID,
	}
}

func (c MultiMoveCommand) Label() string {
	return c.label
}

// Apply moves all nodes to the new parent folder.
func (c MultiMoveCommand) Apply(tree []Node) ([]Node, error) {
	return MoveNodes(tree, c.nodeIDs, c.newParentID)
}

// Undo moves all nodes back to the original parent folder.
func (c MultiMoveCommand) Undo(tree []Node) ([]Node, error) {
	return MoveNodes(tree, c.nodeIDs, c.oldParentID)
}
