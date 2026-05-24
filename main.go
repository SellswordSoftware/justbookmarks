package main

import (
	"context"
	"embed"
	"fmt"
	"os"
	"runtime"

	"github.com/SellswordSoftware/justbookmarks/internal/wailsapi"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	linuxoptions "github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	if runtime.GOOS == "linux" && os.Getenv("GDK_BACKEND") == "" {
		_ = os.Setenv("GDK_BACKEND", "x11")
	}

	app := NewApp()
	handler := wailsapi.NewHandler()

	// Check for CLI file argument
	var filePath string
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	app.filePath = filePath

	err := wails.Run(&options.App{
		Title:     "JustBookmarks",
		Width:     1200,
		Height:    800,
		MinWidth:  900,
		MinHeight: 640,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Linux: &linuxoptions.Options{
			Icon:             appIcon,
			WebviewGpuPolicy: linuxoptions.WebviewGpuPolicyNever,
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
