package bookmarks

import "testing"

func TestPreviewMergeIdenticalFilesProduceNoAdditions(t *testing.T) {
	existing := []Node{
		folderNode("f-work", "Work",
			bookmarkNode("b-github", "GitHub", "https://github.com", "", ""),
		),
	}
	incoming := []Node{
		folderNode("x-work", "Work",
			bookmarkNode("x-github", "GitHub", "https://github.com", "", ""),
		),
	}

	preview, err := PreviewMerge(existing, incoming)
	if err != nil {
		t.Fatalf("PreviewMerge returned error: %v", err)
	}

	if len(preview.FoldersToAdd) != 0 || len(preview.BookmarksToAdd) != 0 || len(preview.PotentialUpdates) != 0 {
		t.Fatalf("expected no additions or updates, got %s", preview.String())
	}
	if len(preview.DuplicateBookmarks) != 1 {
		t.Fatalf("expected 1 duplicate bookmark, got %d", len(preview.DuplicateBookmarks))
	}
}

func TestPreviewMergeDetectsBookmarkUnderExistingFolder(t *testing.T) {
	existing := []Node{
		folderNode("f-work", "Work"),
	}
	incoming := []Node{
		folderNode("x-work", "Work",
			bookmarkNode("x-github", "GitHub", "https://github.com", "", ""),
		),
	}

	preview, err := PreviewMerge(existing, incoming)
	if err != nil {
		t.Fatalf("PreviewMerge returned error: %v", err)
	}

	if len(preview.BookmarksToAdd) != 1 {
		t.Fatalf("expected 1 bookmark to add, got %d", len(preview.BookmarksToAdd))
	}
	if preview.BookmarksToAdd[0].FolderPath != "Work" {
		t.Fatalf("expected folder path Work, got %q", preview.BookmarksToAdd[0].FolderPath)
	}
}

func TestApplyMergeCreatesNestedFolderPath(t *testing.T) {
	existing := []Node{
		folderNode("f-programming", "Programming"),
	}
	incoming := []Node{
		folderNode("x-programming", "Programming",
			folderNode("x-go", "Go",
				bookmarkNode("x-blog", "Go Blog", "https://go.dev/blog", "", ""),
			),
		),
	}

	merged, result, err := ApplyMerge(existing, incoming)
	if err != nil {
		t.Fatalf("ApplyMerge returned error: %v", err)
	}

	if result.FoldersAdded != 1 || result.BookmarksAdded != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}

	programming := findFolderByName(merged, "Programming")
	if programming == nil {
		t.Fatal("expected Programming folder to remain present")
	}
	goFolder := findFolderByName(programming.Children, "Go")
	if goFolder == nil {
		t.Fatal("expected Go subfolder to be created")
	}
	if len(goFolder.Children) != 1 || goFolder.Children[0].Bookmark == nil || goFolder.Children[0].Bookmark.Title != "Go Blog" {
		t.Fatal("expected imported bookmark inside Go folder")
	}
}

func TestPreviewMergeReportsPotentialUpdateForSameURLDifferentTitle(t *testing.T) {
	existing := []Node{
		folderNode("f-work", "Work",
			bookmarkNode("b-gh", "GitHub", "https://github.com", "", ""),
		),
	}
	incoming := []Node{
		folderNode("x-work", "Work",
			bookmarkNode("x-gh", "GitHub Org", "https://github.com", "", ""),
		),
	}

	preview, err := PreviewMerge(existing, incoming)
	if err != nil {
		t.Fatalf("PreviewMerge returned error: %v", err)
	}

	if len(preview.PotentialUpdates) != 1 {
		t.Fatalf("expected 1 potential update, got %d", len(preview.PotentialUpdates))
	}
	if preview.PotentialUpdates[0].ExistingTitle != "GitHub" || preview.PotentialUpdates[0].IncomingTitle != "GitHub Org" {
		t.Fatalf("unexpected update payload: %+v", preview.PotentialUpdates[0])
	}
}

func TestPreviewMergeKeepsSameFolderNamesDistinctByPath(t *testing.T) {
	existing := []Node{
		folderNode("f-work", "Work", folderNode("f-links", "Links")),
		folderNode("f-personal", "Personal"),
	}
	incoming := []Node{
		folderNode("x-personal", "Personal",
			folderNode("x-links", "Links",
				bookmarkNode("x-reddit", "Reddit", "https://reddit.com", "", ""),
			),
		),
	}

	preview, err := PreviewMerge(existing, incoming)
	if err != nil {
		t.Fatalf("PreviewMerge returned error: %v", err)
	}

	if len(preview.FoldersToAdd) != 1 {
		t.Fatalf("expected 1 folder to add, got %d", len(preview.FoldersToAdd))
	}
	if preview.FoldersToAdd[0].Path != "Personal / Links" {
		t.Fatalf("expected Personal / Links, got %q", preview.FoldersToAdd[0].Path)
	}
}

func TestApplyMergeSupportsRootLevelFolderCreation(t *testing.T) {
	existing := []Node{}
	incoming := []Node{
		folderNode("x-root", "Imported"),
	}

	merged, result, err := ApplyMerge(existing, incoming)
	if err != nil {
		t.Fatalf("ApplyMerge returned error: %v", err)
	}

	if len(merged) != 1 || merged[0].Folder == nil || merged[0].Folder.Name != "Imported" {
		t.Fatalf("expected Imported folder at root, got %+v", merged)
	}
	if result.FoldersAdded != 1 {
		t.Fatalf("expected 1 folder added, got %+v", result)
	}
}

func TestPreviewMergeEmptyImportYieldsEmptyPreview(t *testing.T) {
	preview, err := PreviewMerge(buildTestTree(), nil)
	if err != nil {
		t.Fatalf("PreviewMerge returned error: %v", err)
	}

	if preview.HasChanges() || len(preview.DuplicateBookmarks) != 0 || len(preview.PotentialUpdates) != 0 {
		t.Fatalf("expected empty preview, got %s", preview.String())
	}
}

func folderNode(id, name string, children ...Node) Node {
	return Node{
		Type: TypeFolder,
		Folder: &Folder{
			ID:       id,
			Name:     name,
			Children: children,
		},
	}
}

func bookmarkNode(id, title, url, meta, icon string) Node {
	return Node{
		Type: TypeBookmark,
		Bookmark: &Bookmark{
			ID:    id,
			Title: title,
			URL:   url,
			Meta:  meta,
			Icon:  icon,
		},
	}
}
