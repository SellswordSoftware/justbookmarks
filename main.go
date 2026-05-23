package main

import (
	"context"
	"embed"
	"fmt"
	"os"

	"github.com/SellswordSoftware/justbookmarks/internal/wailsapi"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	handler := wailsapi.NewHandler()

	// Check for CLI file argument
	var filePath string
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	app.filePath = filePath

	err := wails.Run(&options.App{
		Title:  "justbookmarks",
		Width:  1200,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.ctx = ctx
			app.handler = handler
		},
		Bind: []interface{}{
			app,
			handler,
		},
	})

	if err != nil {
		fmt.Println("Error:", err.Error())
	}
}
