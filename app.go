package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
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
	return a.openHTMLFilePicker("Open Bookmark File")
}

// OpenImportFilePicker shows a native file picker dialog for import/merge.
func (a *App) OpenImportFilePicker() string {
	return a.openHTMLFilePicker("Import Bookmark File")
}

func (a *App) openHTMLFilePicker(title string) string {
	if a.ctx == nil {
		return ""
	}

	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
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

// CreateBookmarkFile shows a native save dialog, writes an empty Netscape bookmarks file,
// and returns the created path.
func (a *App) CreateBookmarkFile() (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("app context not initialized")
	}

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Create Bookmark File",
		DefaultFilename: "bookmarks.html",
		Filters: []runtime.FileFilter{
			{DisplayName: "HTML Files", Pattern: "*.html"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	if !strings.EqualFold(filepath.Ext(path), ".html") {
		path += ".html"
	}

	if err := os.WriteFile(path, []byte(bookmarks.Serialize([]bookmarks.Node{})), 0o644); err != nil {
		return "", fmt.Errorf("failed to create bookmark file: %w", err)
	}

	a.filePath = path
	return path, nil
}

// LoadBookmarkFile loads the bookmark file into the handler and returns any error.
func (a *App) LoadBookmarkFile(path string) error {
	if a.handler == nil {
		return fmt.Errorf("handler not initialized")
	}
	a.filePath = path
	return a.handler.LoadFile(path)
}
