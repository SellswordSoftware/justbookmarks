package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
)

func main() {
	path := "/home/mike/Downloads/readeck-bookmarks-2026-05-22.html"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}
	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Println("Read error:", err)
		return
	}

	nodes, err := bookmarks.Parse(data)
	if err != nil {
		fmt.Println("Parse error:", err)
		return
	}

	out, _ := json.MarshalIndent(nodes, "", "  ")
	fmt.Println(string(out))
}
