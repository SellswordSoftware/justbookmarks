package main

import (
	"embed"
	"fmt"
	"os"
	"runtime"

	"github.com/SellswordSoftware/justbookmarks/internal/wailsapi"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	if runtime.GOOS == "linux" && os.Getenv("GDK_BACKEND") == "" {
		_ = os.Setenv("GDK_BACKEND", "x11")
	}

	// Check for CLI file argument
	var filePath string
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	app := application.New(application.Options{
		Name: "JustBookmarks",
		Icon: appIcon,
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Linux: application.LinuxOptions{
			ProgramName: "justbookmarks",
		},
	})

	// Create services
	handler := wailsapi.NewHandler()
	appService := NewApp(app, filePath, handler)

	app.RegisterService(application.NewService(appService))
	app.RegisterService(application.NewService(handler))

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "JustBookmarks",
		Width:            1200,
		Height:           800,
		MinWidth:         900,
		MinHeight:        640,
		Frameless:        true,
		BackgroundColour: application.NewRGB(32, 32, 32),
		URL:              "/",
	})

	err := app.Run()
	if err != nil {
		fmt.Println("Error:", err.Error())
	}
}
