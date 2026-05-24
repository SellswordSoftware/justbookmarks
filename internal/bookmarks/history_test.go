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
