package bookmarks

import (
	"fmt"
	"html"
	"strings"
	"time"
)

// Serialize converts a slice of root-level nodes into a Netscape Bookmarks HTML string.
func Serialize(nodes []Node) string {
	var b strings.Builder
	writeHeader(&b)
	writeDL(&b, nodes, 0)
	return b.String()
}

func writeHeader(b *strings.Builder) {
	b.WriteString(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
`)
}

func writeDL(b *strings.Builder, nodes []Node, indent int) {
	writeIndent(b, indent)
	b.WriteString("<DL><p>\n")

	for i := range nodes {
		switch nodes[i].Type {
		case TypeFolder:
			writeFolder(b, &nodes[i], indent+1)
		case TypeBookmark:
			writeBookmark(b, &nodes[i], indent+1)
		}
	}

	writeIndent(b, indent)
	b.WriteString("</DL><p>\n")
}

func writeFolder(b *strings.Builder, node *Node, indent int) {
	folder := node.Folder
	if folder == nil {
		return
	}

	writeIndent(b, indent)
	b.WriteString("<DT><H3")

	writeAttrIfSet(b, "ADD_DATE", folder.AddDate)
	writeAttrIfSet(b, "LAST_MODIFIED", folder.LastModified)
	writeAttrIfNonEmpty(b, "ICON", folder.Icon)
	writeAttrIfNonEmpty(b, "META", folder.Meta)

	b.WriteString(">")
	b.WriteString(html.EscapeString(folder.Name))
	b.WriteString("</H3>\n")

	if len(folder.Children) > 0 {
		writeDL(b, folder.Children, indent+1)
	} else {
		writeIndent(b, indent+1)
		b.WriteString("<DL><p>\n")
		writeIndent(b, indent+1)
		b.WriteString("</DL><p>\n")
	}
}

func writeBookmark(b *strings.Builder, node *Node, indent int) {
	bm := node.Bookmark
	if bm == nil {
		return
	}

	writeIndent(b, indent)
	b.WriteString("<DT><A")

	// HREF is always written
	b.WriteString(fmt.Sprintf(` HREF="%s"`, html.EscapeString(bm.URL)))

	writeAttrIfSet(b, "ADD_DATE", bm.AddDate)
	writeAttrIfSet(b, "LAST_MODIFIED", bm.LastModified)
	writeAttrIfNonEmpty(b, "ICON", bm.Icon)
	writeAttrIfNonEmpty(b, "ICON_URI", bm.IconURI)
	writeAttrIfNonEmpty(b, "META", bm.Meta)

	b.WriteString(">")
	b.WriteString(html.EscapeString(bm.Title))
	b.WriteString("</A>\n")
}

func writeAttrIfSet(b *strings.Builder, name string, t any) {
	switch v := t.(type) {
	case int64:
		if v != 0 {
			b.WriteString(fmt.Sprintf(` %s="%d"`, name, v))
		}
	case time.Time:
		if !v.IsZero() {
			b.WriteString(fmt.Sprintf(` %s="%d"`, name, v.Unix()))
		}
	}
}

func writeAttrIfNonEmpty(b *strings.Builder, name string, value string) {
	if value != "" {
		b.WriteString(fmt.Sprintf(` %s="%s"`, name, html.EscapeString(value)))
	}
}

func writeIndent(b *strings.Builder, level int) {
	for i := 0; i < level; i++ {
		b.WriteString("    ")
	}
}
