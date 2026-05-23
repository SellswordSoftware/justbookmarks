// Wails v2 API wrapper — calls bound Go methods through the Wails runtime.
// The binding proxies are created at runtime by Wails at window.go[namespace][Class].
//
// IMPORTANT: Access bindings lazily inside each function rather than capturing them
// at module load time. Wails initializes window.go dynamically, and early captures
// can grab stale/placeholder proxies that cause "cannot unmarshal object into Go
// value of type string" errors when the bridge receives malformed requests.
//
// Also guard against window.go not being ready — when running in a plain browser
// (Vite dev server) the Wails bridge doesn't exist.

// --- App bindings (main package) ---
// Wails v2 proxy methods return Promises. Always await them.

export async function GetFilePath() {
	if (typeof window.go === 'undefined' || !window.go.main || !window.go.main.App) {
		return '';
	}
	const result = await window.go.main.App.GetFilePath();
	return typeof result === 'string' ? result : '';
}

export async function OpenFilePicker() {
	if (typeof window.go === 'undefined' || !window.go.main || !window.go.main.App) {
		return '';
	}
	const result = await window.go.main.App.OpenFilePicker();
	return typeof result === 'string' ? result : '';
}

export async function LoadBookmarkFile(path) {
	if (typeof window.go === 'undefined' || !window.go.main || !window.go.main.App) {
		return;
	}
	return await window.go.main.App.LoadBookmarkFile(path);
}

// --- Handler bindings (wailsapi package) ---
// Go signatures:
//   LoadFile(path string) error
//   GetTree() []bookmarks.Node
//   GetFlatIndex() []bookmarks.BookmarkIndexEntry
//   GetAllFolders() []bookmarks.Node
//   AddBookmark(parentID string, bm bookmarks.Bookmark) (string, error)
//   AddFolder(parentID string, name string) (string, error)
//   UpdateBookmark(id string, bm bookmarks.Bookmark) error
//   UpdateFolderName(id string, name string) error
//   DeleteNode(id string) error
//   MoveNode(nodeID, newParentID string, newIndex int) error
//   FetchPageTitle(pageURL string) (string, error)
//   FetchFavicon(pageURL string) (string, error)
//   OpenURL(pageURL string) error
//   FilePath() string

function getHandler() {
	// Wails v2 binds structs at window.go[package][StructName]
	// Handler is in package wailsapi, App is in package main
	const h = window.go?.wailsapi?.Handler ?? window.go?.main?.Handler;
	if (!h) {
		console.warn('[api] Handler not found at window.go.wailsapi.Handler or window.go.main.Handler');
		console.log('[api] window.go keys:', window.go ? Object.keys(window.go) : 'window.go is undefined');
		if (window.go?.wailsapi) {
			console.log('[api] wailsapi keys:', Object.keys(window.go.wailsapi));
		}
		if (window.go?.main) {
			console.log('[api] main keys:', Object.keys(window.go.main));
		}
	}
	return h;
}

export function LoadFile(path) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.LoadFile(path);
}

export async function GetTree() {
	const handler = getHandler();
	if (!handler) return [];
	return await handler.GetTree();
}

export async function GetFlatIndex() {
	const handler = getHandler();
	if (!handler) return [];
	return await handler.GetFlatIndex();
}

export async function GetAllFolders() {
	const handler = getHandler();
	if (!handler) return [];
	return await handler.GetAllFolders();
}

// AddBookmark — bm is a Bookmark partial object {title, url, icon, iconURI, meta}
export function AddBookmark(parentFolderId, bm) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.AddBookmark(parentFolderId, bm);
}

// AddFolder — name is a plain string
export function AddFolder(parentFolderId, name) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.AddFolder(parentFolderId, name);
}

// UpdateBookmark — bm is a Bookmark partial object {title, url, icon, iconURI, meta}
export function UpdateBookmark(id, bm) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.UpdateBookmark(id, bm);
}

// UpdateFolderName — name is a plain string
export function UpdateFolderName(id, name) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.UpdateFolderName(id, name);
}

export function DeleteNode(id) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.DeleteNode(id);
}

export function MoveNode(draggedId, targetFolderId, index) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.MoveNode(draggedId, targetFolderId, index);
}

export function FetchPageTitle(url) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.FetchPageTitle(url);
}

export function FetchFavicon(url) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.FetchFavicon(url);
}

export function OpenURL(url) {
	const handler = getHandler();
	if (!handler) return Promise.reject(new Error('Wails bridge not ready'));
	return handler.OpenURL(url);
}

export async function FilePath() {
	const handler = getHandler();
	if (!handler) return '';
	return await handler.FilePath();
}
