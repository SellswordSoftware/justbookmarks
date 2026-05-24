import type {
	BookmarkCreate,
	BookmarkConflictItem,
	BookmarkIndexEntry,
	BookmarkMergeItem,
	BookmarkPatch,
	FolderMergeItem,
	MergeApplyResult,
	MergePreview,
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

export async function CreateBookmarkFile(): Promise<string> {
	const app = getAppBindings();
	if (!app) {
		throw new Error('Wails bridge not ready');
	}

	return app.CreateBookmarkFile();
}

export async function OpenFilePicker(): Promise<string> {
	const app = getAppBindings();
	return app ? app.OpenFilePicker() : '';
}

export async function OpenImportFilePicker(): Promise<string> {
	const app = getAppBindings();
	return app ? app.OpenImportFilePicker() : '';
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

export async function DeleteNodes(ids: string[]): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.DeleteNodes(ids);
}

export async function MoveNode(draggedId: string, targetFolderId: string, index: number): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.MoveNode(draggedId, targetFolderId, index);
}

export async function MoveNodes(nodeIds: string[], targetFolderId: string): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.MoveNodes(nodeIds, targetFolderId);
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

export async function FetchFaviconsForNodes(ids: string[]): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.FetchFaviconsForNodes(ids);
}

export async function RefreshTitlesForNodes(ids: string[]): Promise<void> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	await handler.RefreshTitlesForNodes(ids);
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

function normalizeFolderMergeItem(item: FolderMergeItem): FolderMergeItem {
	return {
		path: item?.path ?? '',
		name: item?.name ?? '',
	};
}

function normalizeBookmarkMergeItem(item: BookmarkMergeItem): BookmarkMergeItem {
	return {
		folderPath: item?.folderPath ?? '',
		title: item?.title ?? '',
		url: item?.url ?? '',
	};
}

function normalizeConflictItem(item: BookmarkConflictItem): BookmarkConflictItem {
	return {
		folderPath: item?.folderPath ?? '',
		existingTitle: item?.existingTitle ?? '',
		incomingTitle: item?.incomingTitle ?? '',
		url: item?.url ?? '',
		existingMeta: item?.existingMeta ?? '',
		incomingMeta: item?.incomingMeta ?? '',
	};
}

export async function PreviewImportMerge(path: string): Promise<MergePreview> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	const preview = await handler.PreviewImportMerge(path);
	return {
		foldersToAdd: (preview?.foldersToAdd ?? []).map(normalizeFolderMergeItem),
		bookmarksToAdd: (preview?.bookmarksToAdd ?? []).map(normalizeBookmarkMergeItem),
		duplicateBookmarks: (preview?.duplicateBookmarks ?? []).map(normalizeBookmarkMergeItem),
		potentialUpdates: (preview?.potentialUpdates ?? []).map(normalizeConflictItem),
	};
}

export async function ApplyImportMerge(path: string): Promise<MergeApplyResult> {
	const handler = getHandlerBindings();
	if (!handler) {
		throw new Error('Wails bridge not ready');
	}

	const result = await handler.ApplyImportMerge(path);
	return {
		foldersAdded: result?.foldersAdded ?? 0,
		bookmarksAdded: result?.bookmarksAdded ?? 0,
		duplicatesSkipped: result?.duplicatesSkipped ?? 0,
		potentialUpdates: result?.potentialUpdates ?? 0,
	};
}
