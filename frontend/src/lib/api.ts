import type {
	BookmarkCreate,
	BookmarkIndexEntry,
	BookmarkPatch,
	TreeNode,
} from './types';

function getAppBindings(): WailsAppBindings | null {
	return window.go?.main?.App ?? null;
}

function getHandlerBindings(): WailsHandlerBindings | null {
	return window.go?.wailsapi?.Handler ?? window.go?.main?.Handler ?? null;
}

export async function GetFilePath(): Promise<string> {
	const app = getAppBindings();
	return app ? app.GetFilePath() : '';
}

export async function OpenFilePicker(): Promise<string> {
	const app = getAppBindings();
	return app ? app.OpenFilePicker() : '';
}

export async function LoadBookmarkFile(path: string): Promise<void> {
	const app = getAppBindings();
	if (!app) return;
	await app.LoadBookmarkFile(path);
}

export async function LoadFile(path: string): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.LoadFile(path);
}

export async function GetTree(): Promise<TreeNode[]> {
	const handler = getHandlerBindings();
	return handler ? handler.GetTree() : [];
}

export async function GetFlatIndex(): Promise<BookmarkIndexEntry[]> {
	const handler = getHandlerBindings();
	return handler ? handler.GetFlatIndex() : [];
}

export async function GetAllFolders(): Promise<TreeNode[]> {
	const handler = getHandlerBindings();
	return handler ? handler.GetAllFolders() : [];
}

export async function AddBookmark(parentFolderId: string, bookmark: BookmarkCreate): Promise<string> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	return handler.AddBookmark(parentFolderId, bookmark);
}

export async function AddFolder(parentFolderId: string, name: string): Promise<string> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	return handler.AddFolder(parentFolderId, name);
}

export async function UpdateBookmark(id: string, patch: BookmarkPatch): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.UpdateBookmark(id, patch);
}

export async function UpdateFolderName(id: string, name: string): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.UpdateFolderName(id, name);
}

export async function DeleteNode(id: string): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.DeleteNode(id);
}

export async function MoveNode(draggedId: string, targetFolderId: string, index: number): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.MoveNode(draggedId, targetFolderId, index);
}

export async function FetchPageTitle(url: string): Promise<string> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	return handler.FetchPageTitle(url);
}

export async function FetchFavicon(url: string): Promise<string> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	return handler.FetchFavicon(url);
}

export async function OpenURL(url: string): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.OpenURL(url);
}

export async function FilePath(): Promise<string> {
	const handler = getHandlerBindings();
	return handler ? handler.FilePath() : '';
}
