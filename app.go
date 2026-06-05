package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/SellswordSoftware/justbookmarks/internal/bookmarks"
	"github.com/SellswordSoftware/justbookmarks/internal/wailsapi"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// App is the main application service.
type App struct {
	app      *application.App
	handler  *wailsapi.Handler
	filePath string
}

// NewApp creates a new App service.
func NewApp(appInst *application.App, cliFilePath string, handler *wailsapi.Handler) *App {
	return &App{
		app:      appInst,
		handler:  handler,
		filePath: cliFilePath,
	}
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
	result, err := a.app.Dialog.OpenFile().
		SetTitle(title).
		AddFilter("HTML Files", "*.html").
		AddFilter("All Files", "*.*").
		PromptForSingleSelection()
	if err != nil {
		return ""
	}
	return result
}

// CreateBookmarkFile shows a native save dialog, writes an empty Netscape bookmarks file,
// and returns the created path.
func (a *App) CreateBookmarkFile() (string, error) {
	path, err := a.app.Dialog.SaveFile().
		SetMessage("Create Bookmark File").
		SetFilename("bookmarks.html").
		AddFilter("HTML Files", "*.html").
		PromptForSingleSelection()
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
