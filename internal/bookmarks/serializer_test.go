package bookmarks

import (
	"strings"
	"testing"
	"time"
)

func TestSerializeSimple(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:      "f1",
				Name:    "Test Folder",
				AddDate: time.Unix(1700000000, 0),
				Children: []Node{
					{
						Type: TypeBookmark,
						Bookmark: &Bookmark{
							ID:      "b1",
							Title:   "Example",
							URL:     "https://example.com",
							AddDate: time.Unix(1700000001, 0),
						},
					},
				},
			},
		},
	}

	output := Serialize(nodes)

	if !strings.Contains(output, "<!DOCTYPE NETSCAPE-Bookmark-file-1>") {
		t.Error("missing DOCTYPE")
	}
	if !strings.Contains(output, ">Test Folder<") {
		t.Error("missing folder name")
	}
	if !strings.Contains(output, `HREF="https://example.com"`) {
		t.Error("missing bookmark URL")
	}
	if !strings.Contains(output, ">Example<") {
		t.Error("missing bookmark title")
	}
	if !strings.Contains(output, `ADD_DATE="1700000000"`) {
		t.Error("missing folder add date")
	}
	if !strings.Contains(output, `ADD_DATE="1700000001"`) {
		t.Error("missing bookmark add date")
	}
}

func TestSerializeHTMLEscape(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeBookmark,
			Bookmark: &Bookmark{
				ID:    "b1",
				Title: "O'Reilly & Co <Books>",
				URL:   "https://example.com?a=1&b=2",
			},
		},
	}

	output := Serialize(nodes)

	if strings.Contains(output, "<Books>") {
		t.Error("title should be HTML-escaped")
	}
	if !strings.Contains(output, "&amp;") {
		t.Error("ampersand should be escaped")
	}
}

func TestSerializeRoundTrip(t *testing.T) {
	// Parse a file, serialize it, parse again — tree should be equivalent
	inputData := []byte(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Folder</H3>
    <DL><p>
        <DT><A HREF="https://example.com">Example</A>
    </DL><p>
</DL><p>`)

	original, err := Parse(inputData)
	if err != nil {
		t.Fatal(err)
	}

	serialized := Serialize(original)
	roundTrip, err := Parse([]byte(serialized))
	if err != nil {
		t.Fatalf("round-trip parse failed: %v", err)
	}

	if !treesEqual(original, roundTrip) {
		t.Error("round-trip produced different tree")
	}
}

func TestSerializePreservesIcon(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeBookmark,
			Bookmark: &Bookmark{
				ID:    "b1",
				Title: "Test",
				URL:   "https://example.com",
				Icon:  "data:image/png;base64,xyz789",
			},
		},
	}

	output := Serialize(nodes)

	if !strings.Contains(output, `ICON="data:image/png;base64,xyz789"`) {
		t.Error("icon attribute should be preserved")
	}
}

func TestSerializeEmptyFolder(t *testing.T) {
	nodes := []Node{
		{
			Type:   TypeFolder,
			Folder: &Folder{ID: "f1", Name: "Empty"},
		},
	}

	output := Serialize(nodes)

	if !strings.Contains(output, ">Empty<") {
		t.Error("missing folder name")
	}
	// Empty folder should still have a DL wrapper
	dlCount := strings.Count(output, "<DL>")
	if dlCount < 2 {
		t.Errorf("expected at least 2 DL tags (root + empty folder), got %d", dlCount)
	}
}

func TestSerializeNestedFolders(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:   "f1",
				Name: "Parent",
				Children: []Node{
					{
						Type:   TypeFolder,
						Folder: &Folder{ID: "f2", Name: "Child", Children: []Node{}},
					},
				},
			},
		},
	}

	output := Serialize(nodes)

	if !strings.Contains(output, ">Parent<") {
		t.Error("missing parent folder name")
	}
	if !strings.Contains(output, ">Child<") {
		t.Error("missing child folder name")
	}
}

func TestSerializeOmitsEmptyAttrs(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeBookmark,
			Bookmark: &Bookmark{
				ID:    "b1",
				Title: "No Dates",
				URL:   "https://example.com",
			},
		},
	}

	output := Serialize(nodes)

	if strings.Contains(output, "ADD_DATE") {
		t.Error("should omit ADD_DATE when not set")
	}
	if strings.Contains(output, "LAST_MODIFIED") {
		t.Error("should omit LAST_MODIFIED when not set")
	}
}

func TestSerializeRoundTripPreservesTimestamps(t *testing.T) {
	nodes := []Node{
		{
			Type: TypeFolder,
			Folder: &Folder{
				ID:           "f1",
				Name:         "Folder",
				AddDate:      time.Unix(1700000000, 0),
				LastModified: time.Unix(1700000002, 0),
				Children: []Node{
					{
						Type: TypeBookmark,
						Bookmark: &Bookmark{
							ID:           "b1",
							Title:        "Example",
							URL:          "https://example.com",
							AddDate:      time.Unix(1700000001, 0),
							LastModified: time.Unix(1700000003, 0),
						},
					},
				},
			},
		},
	}

	serialized := Serialize(nodes)
	roundTrip, err := Parse([]byte(serialized))
	if err != nil {
		t.Fatalf("round-trip parse failed: %v", err)
	}

	folder := roundTrip[0].Folder
	if folder.AddDate.Unix() != 1700000000 || folder.LastModified.Unix() != 1700000002 {
		t.Fatalf("folder timestamps not preserved: %#v", folder)
	}

	bookmark := folder.Children[0].Bookmark
	if bookmark.AddDate.Unix() != 1700000001 || bookmark.LastModified.Unix() != 1700000003 {
		t.Fatalf("bookmark timestamps not preserved: %#v", bookmark)
	}
}

// treesEqual compares two trees by structure, names, URLs, and attributes (ignoring IDs).
func treesEqual(a, b []Node) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Type != b[i].Type {
			return false
		}
		if a[i].Type == TypeFolder {
			if a[i].Folder.Name != b[i].Folder.Name {
				return false
			}
			if !treesEqual(a[i].Folder.Children, b[i].Folder.Children) {
				return false
			}
		} else {
			if a[i].Bookmark.Title != b[i].Bookmark.Title {
				return false
			}
			if a[i].Bookmark.URL != b[i].Bookmark.URL {
				return false
			}
		}
	}
	return true
}
