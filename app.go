package main

import (
	"context"
	"fmt"

	"github.com/SellswordSoftware/justbookmarks/internal/wailsapi"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx      context.Context
	handler  *wailsapi.Handler
	filePath string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetFilePath returns the file path passed via CLI arg.
func (a *App) GetFilePath() string {
	return a.filePath
}

// OpenFilePicker shows a native file picker dialog and returns the selected path.
func (a *App) OpenFilePicker() string {
	if a.ctx == nil {
		return ""
	}

	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Bookmark File",
		Filters: []runtime.FileFilter{
			{DisplayName: "HTML Files", Pattern: "*.html"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return ""
	}
	return file
}

// LoadBookmarkFile loads the bookmark file into the handler and returns any error.
func (a *App) LoadBookmarkFile(path string) error {
	if a.handler == nil {
		return fmt.Errorf("handler not initialized")
	}
	return a.handler.LoadFile(path)
}
