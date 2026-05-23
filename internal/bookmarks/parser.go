package bookmarks

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"
)

// Parse reads a Netscape Bookmarks HTML file and returns the root-level nodes.
func Parse(data []byte) ([]Node, error) {
	doc, err := html.Parse(strings.NewReader(string(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Walk the DOM to find the top-level <DL> that contains our bookmarks.
	var rootDL *html.Node
	findRootDL(doc, &rootDL)
	if rootDL == nil {
		return nil, fmt.Errorf("no bookmark data found (missing root <DL>)")
	}

	nodes := parseDL(rootDL)
	return nodes, nil
}

// findRootDL locates the first <DL> element in the document.
func findRootDL(n *html.Node, result **html.Node) {
	if n.Type == html.ElementNode && n.Data == "dl" {
		if *result == nil {
			*result = n
			return
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		findRootDL(c, result)
	}
}

// parseDL parses the children of a <DL> element into []Node.
func parseDL(dl *html.Node) []Node {
	var nodes []Node
	for c := dl.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && c.Data == "dt" {
			nodes = append(nodes, parseDT(c)...)
		}
	}
	return nodes
}

// parseDT parses a <DT> element, which contains either an <H3> (folder) or an <A> (bookmark).
func parseDT(dt *html.Node) []Node {
	for c := dt.FirstChild; c != nil; c = c.NextSibling {
		if c.Type != html.ElementNode {
			continue
		}
		switch c.Data {
		case "h3":
			return []Node{parseFolder(c)}
		case "a":
			return []Node{parseBookmark(c)}
		}
	}
	return nil
}

// parseFolder parses an <H3> element into a Folder node.
func parseFolder(h3 *html.Node) Node {
	folder := &Folder{
		ID: GenerateID(),
	}

	for _, attr := range h3.Attr {
		switch strings.ToLower(attr.Key) {
		case "add_date":
			if t, err := parseTimestamp(attr.Val); err == nil {
				folder.AddDate = t
			}
		case "last_modified":
			if t, err := parseTimestamp(attr.Val); err == nil {
				folder.LastModified = t
			}
		case "icon":
			folder.Icon = attr.Val
		case "meta":
			folder.Meta = attr.Val
		}
	}

	// Folder name is the text content of <H3>.
	folder.Name = extractText(h3)

	// Look for the next sibling <DL> that contains this folder's children.
	var childrenDL *html.Node
	for sib := h3.NextSibling; sib != nil; sib = sib.NextSibling {
		if sib.Type == html.ElementNode && sib.Data == "dl" {
			childrenDL = sib
			break
		}
	}

	if childrenDL != nil {
		folder.Children = parseDL(childrenDL)
	} else {
		folder.Children = []Node{}
	}

	return Node{Type: TypeFolder, Folder: folder}
}

// parseBookmark parses an <A> element into a Bookmark node.
func parseBookmark(a *html.Node) Node {
	bm := &Bookmark{
		ID: GenerateID(),
	}

	for _, attr := range a.Attr {
		switch strings.ToLower(attr.Key) {
		case "href":
			bm.URL = attr.Val
		case "add_date":
			if t, err := parseTimestamp(attr.Val); err == nil {
				bm.AddDate = t
			}
		case "last_modified":
			if t, err := parseTimestamp(attr.Val); err == nil {
				bm.LastModified = t
			}
		case "icon":
			bm.Icon = attr.Val
		case "icon_uri":
			bm.IconURI = attr.Val
		case "meta":
			bm.Meta = attr.Val
		}
	}

	// Bookmark title is the text content of <A>.
	bm.Title = extractText(a)

	return Node{Type: TypeBookmark, Bookmark: bm}
}

// parseTimestamp parses a Unix timestamp string (seconds) into a time.Time.
func parseTimestamp(s string) (time.Time, error) {
	sec, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(sec, 0), nil
}

// extractText collects all text content from a node and its descendants.
func extractText(n *html.Node) string {
	var b strings.Builder
	walkText(n, &b)
	return b.String()
}

func walkText(n *html.Node, b *strings.Builder) {
	if n.Type == html.TextNode {
		b.WriteString(n.Data)
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		walkText(c, b)
	}
}
