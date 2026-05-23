package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
)

func main() {
	data, _ := os.ReadFile(os.Args[1])
	tree, err := bookmarks.Parse(data)
	if err != nil {
		fmt.Println("Parse error:", err)
		return
	}
	j, _ := json.MarshalIndent(tree, "", "  ")
	fmt.Println(string(j))
}
