package bookmarks

import "testing"

func TestCloneTreeDeepCopiesNestedNodes(t *testing.T) {
	original := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:   "f-work",
				Name: "Work",
				Children: []Node{
					{
						Type: TypeBookmark,
						Bookmark: &Bookmark{
							ID:    "b-gh",
							Title: "GitHub",
							URL:   "https://github.com",
						},
					},
				},
			},
		},
	}

	cloned := CloneTree(original)
	cloned[0].Folder.Name = "Changed"
	cloned[0].Folder.Children[0].Bookmark.Title = "Changed Bookmark"

	if original[0].Folder.Name != "Work" {
		t.Fatalf("expected original folder name to stay unchanged, got %q", original[0].Folder.Name)
	}
	if original[0].Folder.Children[0].Bookmark.Title != "GitHub" {
		t.Fatalf("expected original bookmark title to stay unchanged, got %q", original[0].Folder.Children[0].Bookmark.Title)
	}
}

func TestSnapshotCommandApplyAndUndoUseSnapshots(t *testing.T) {
	before := []Node{
		bookmarkNode("b-before", "Before", "https://before.example", "", ""),
	}
	after := []Node{
		bookmarkNode("b-after", "After", "https://after.example", "", ""),
	}

	command := NewSnapshotCommand("Rename Bookmark", before, after)

	applied, err := command.Apply(nil)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	undone, err := command.Undo(nil)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}

	if len(applied) != 1 || applied[0].Bookmark == nil || applied[0].Bookmark.Title != "After" {
		t.Fatalf("expected apply snapshot to be returned, got %+v", applied)
	}
	if len(undone) != 1 || undone[0].Bookmark == nil || undone[0].Bookmark.Title != "Before" {
		t.Fatalf("expected undo snapshot to be returned, got %+v", undone)
	}

	applied[0].Bookmark.Title = "Mutated"
	undone[0].Bookmark.Title = "Mutated"

	reapplied, err := command.Apply(nil)
	if err != nil {
		t.Fatalf("second Apply returned error: %v", err)
	}
	reundone, err := command.Undo(nil)
	if err != nil {
		t.Fatalf("second Undo returned error: %v", err)
	}

	if reapplied[0].Bookmark.Title != "After" {
		t.Fatalf("expected apply snapshot to stay immutable, got %q", reapplied[0].Bookmark.Title)
	}
	if reundone[0].Bookmark.Title != "Before" {
		t.Fatalf("expected undo snapshot to stay immutable, got %q", reundone[0].Bookmark.Title)
	}
}

func TestAddCommandUndoAndRedoBookmarkAtRoot(t *testing.T) {
	tree := []Node{
		bookmarkNode("b-existing", "Existing", "https://existing.example", "", ""),
	}

	created := bookmarkNode("b-new", "New", "https://new.example", "", "")
	cmd := NewAddCommand("Add Bookmark", "", created)

	// Apply adds the bookmark to root
	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	if len(applied) != 2 {
		t.Fatalf("expected 2 nodes after apply, got %d", len(applied))
	}
	if applied[1].Bookmark.Title != "New" {
		t.Fatalf("expected New bookmark at root, got %q", applied[1].Bookmark.Title)
	}

	// Undo removes it
	undone, err := cmd.Undo(applied)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	if len(undone) != 1 {
		t.Fatalf("expected 1 node after undo, got %d", len(undone))
	}
	if undone[0].Bookmark.Title != "Existing" {
		t.Fatalf("expected only Existing bookmark after undo, got %q", undone[0].Bookmark.Title)
	}

	// Redo re-adds it
	reapplied, err := cmd.Apply(undone)
	if err != nil {
		t.Fatalf("Redo Apply returned error: %v", err)
	}
	if len(reapplied) != 2 {
		t.Fatalf("expected 2 nodes after redo, got %d", len(reapplied))
	}
}

func TestAddCommandUndoAndRedoBookmarkInFolder(t *testing.T) {
	tree := []Node{
		folderNode("f-work", "Work",
			bookmarkNode("b-gh", "GitHub", "https://github.com", "", ""),
		),
	}

	created := bookmarkNode("b-mdn", "MDN", "https://developer.mozilla.org", "", "")
	cmd := NewAddCommand("Add Bookmark", "f-work", created)

	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	workFolder := FindFolder(applied, "f-work")
	if workFolder == nil {
		t.Fatal("expected Work folder to exist")
	}
	if len(workFolder.Folder.Children) != 2 {
		t.Fatalf("expected 2 children in Work folder, got %d", len(workFolder.Folder.Children))
	}

	undone, err := cmd.Undo(applied)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	workFolder = FindFolder(undone, "f-work")
	if workFolder == nil {
		t.Fatal("expected Work folder to exist")
	}
	if len(workFolder.Folder.Children) != 1 {
		t.Fatalf("expected 1 child after undo, got %d", len(workFolder.Folder.Children))
	}

	reapplied, err := cmd.Apply(undone)
	if err != nil {
		t.Fatalf("Redo Apply returned error: %v", err)
	}
	workFolder = FindFolder(reapplied, "f-work")
	if workFolder == nil {
		t.Fatal("expected Work folder to exist")
	}
	if len(workFolder.Folder.Children) != 2 {
		t.Fatalf("expected 2 children after redo, got %d", len(workFolder.Folder.Children))
	}
}

func TestAddCommandUndoAndRedoFolderAtRoot(t *testing.T) {
	tree := []Node{
		folderNode("f-existing", "Existing"),
	}

	created := folderNode("f-new", "New")
	cmd := NewAddCommand("Add Folder", "", created)

	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	if len(applied) != 2 {
		t.Fatalf("expected 2 root nodes after apply, got %d", len(applied))
	}

	undone, err := cmd.Undo(applied)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	if len(undone) != 1 {
		t.Fatalf("expected 1 root node after undo, got %d", len(undone))
	}

	reapplied, err := cmd.Apply(undone)
	if err != nil {
		t.Fatalf("Redo Apply returned error: %v", err)
	}
	if len(reapplied) != 2 {
		t.Fatalf("expected 2 root nodes after redo, got %d", len(reapplied))
	}
}

func TestAddCommandStoresClonedNode(t *testing.T) {
	created := bookmarkNode("b-new", "New", "https://new.example", "", "")
	cmd := NewAddCommand("Add Bookmark", "", created)

	// Mutate the original after command creation
	created.Bookmark.Title = "Mutated"

	tree := []Node{}
	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	if applied[0].Bookmark.Title != "New" {
		t.Fatalf("expected stored node to be cloned, got %q", applied[0].Bookmark.Title)
	}
}

func TestAddCommandLabel(t *testing.T) {
	cmd := NewAddCommand("Add Bookmark", "", bookmarkNode("b-1", "Test", "", "", ""))
	if cmd.Label() != "Add Bookmark" {
		t.Fatalf("expected label 'Add Bookmark', got %q", cmd.Label())
	}
}

func TestMoveCommandUndoAndRedo(t *testing.T) {
	tree := []Node{
		folderNode("f-root", "Root",
			bookmarkNode("b-1", "First", "https://first.example", "", ""),
		),
		folderNode("f-target", "Target"),
	}

	// Move b-1 from f-root to f-target at index 0
	cmd := NewMoveCommand("Move Bookmark", "b-1", "f-root", 0, "f-target", 0)

	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	targetFolder := FindFolder(applied, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 1 {
		t.Fatalf("expected 1 child in Target, got %d", len(targetFolder.Folder.Children))
	}
	rootFolder := FindFolder(applied, "f-root")
	if rootFolder == nil {
		t.Fatal("expected Root folder to exist")
	}
	if len(rootFolder.Folder.Children) != 0 {
		t.Fatalf("expected 0 children in Root after move, got %d", len(rootFolder.Folder.Children))
	}

	// Undo moves it back
	undone, err := cmd.Undo(applied)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	targetFolder = FindFolder(undone, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 0 {
		t.Fatalf("expected 0 children in Target after undo, got %d", len(targetFolder.Folder.Children))
	}
	rootFolder = FindFolder(undone, "f-root")
	if rootFolder == nil {
		t.Fatal("expected Root folder to exist")
	}
	if len(rootFolder.Folder.Children) != 1 {
		t.Fatalf("expected 1 child in Root after undo, got %d", len(rootFolder.Folder.Children))
	}

	// Redo moves it again
	reapplied, err := cmd.Apply(undone)
	if err != nil {
		t.Fatalf("Redo Apply returned error: %v", err)
	}
	targetFolder = FindFolder(reapplied, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 1 {
		t.Fatalf("expected 1 child in Target after redo, got %d", len(targetFolder.Folder.Children))
	}
}

func TestMoveCommandRootToFolder(t *testing.T) {
	tree := []Node{
		bookmarkNode("b-1", "First", "https://first.example", "", ""),
		folderNode("f-target", "Target"),
	}

	cmd := NewMoveCommand("Move Bookmark", "b-1", "", 0, "f-target", 0)

	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	// After moving b-1 into Target folder, only Target folder remains at root
	if len(applied) != 1 {
		t.Fatalf("expected 1 root node after move, got %d", len(applied))
	}
	targetFolder := FindFolder(applied, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 1 {
		t.Fatalf("expected 1 child in Target, got %d", len(targetFolder.Folder.Children))
	}

	undone, err := cmd.Undo(applied)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	// Undo moves b-1 back to root
	if len(undone) != 2 {
		t.Fatalf("expected 2 root nodes after undo, got %d", len(undone))
	}
	undoneTarget := FindFolder(undone, "f-target")
	if undoneTarget == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(undoneTarget.Folder.Children) != 0 {
		t.Fatalf("expected 0 children in Target after undo, got %d", len(undoneTarget.Folder.Children))
	}
}

func TestMultiMoveCommandUndoAndRedo(t *testing.T) {
	tree := []Node{
		folderNode("f-source", "Source",
			bookmarkNode("b-1", "First", "https://first.example", "", ""),
			bookmarkNode("b-2", "Second", "https://second.example", "", ""),
		),
		folderNode("f-target", "Target"),
	}

	cmd := NewMultiMoveCommand("Move 2 Items", []string{"b-1", "b-2"}, "f-source", "f-target")

	applied, err := cmd.Apply(tree)
	if err != nil {
		t.Fatalf("Apply returned error: %v", err)
	}
	targetFolder := FindFolder(applied, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 2 {
		t.Fatalf("expected 2 children in Target, got %d", len(targetFolder.Folder.Children))
	}
	sourceFolder := FindFolder(applied, "f-source")
	if sourceFolder == nil {
		t.Fatal("expected Source folder to exist")
	}
	if len(sourceFolder.Folder.Children) != 0 {
		t.Fatalf("expected 0 children in Source after move, got %d", len(sourceFolder.Folder.Children))
	}

	undone, err := cmd.Undo(applied)
	if err != nil {
		t.Fatalf("Undo returned error: %v", err)
	}
	sourceFolder = FindFolder(undone, "f-source")
	if sourceFolder == nil {
		t.Fatal("expected Source folder to exist")
	}
	if len(sourceFolder.Folder.Children) != 2 {
		t.Fatalf("expected 2 children in Source after undo, got %d", len(sourceFolder.Folder.Children))
	}
	targetFolder = FindFolder(undone, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 0 {
		t.Fatalf("expected 0 children in Target after undo, got %d", len(targetFolder.Folder.Children))
	}

	reapplied, err := cmd.Apply(undone)
	if err != nil {
		t.Fatalf("Redo Apply returned error: %v", err)
	}
	targetFolder = FindFolder(reapplied, "f-target")
	if targetFolder == nil {
		t.Fatal("expected Target folder to exist")
	}
	if len(targetFolder.Folder.Children) != 2 {
		t.Fatalf("expected 2 children in Target after redo, got %d", len(targetFolder.Folder.Children))
	}
}

func TestMoveCommandLabel(t *testing.T) {
	cmd := NewMoveCommand("Move Bookmark", "b-1", "f-a", 0, "f-b", 0)
	if cmd.Label() != "Move Bookmark" {
		t.Fatalf("expected label 'Move Bookmark', got %q", cmd.Label())
	}
}

func TestMultiMoveCommandLabel(t *testing.T) {
	cmd := NewMultiMoveCommand("Move 3 Items", []string{"b-1", "b-2", "b-3"}, "f-a", "f-b")
	if cmd.Label() != "Move 3 Items" {
		t.Fatalf("expected label 'Move 3 Items', got %q", cmd.Label())
	}
}
