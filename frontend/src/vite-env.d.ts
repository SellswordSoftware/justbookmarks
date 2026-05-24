/// <reference types="svelte" />
/// <reference types="vite/client" />

import type {
	BookmarkCreate,
	BookmarkConflictItem,
	BookmarkIndexEntry,
	BookmarkMergeItem,
	BookmarkPatch,
	FolderMergeItem,
	MergeApplyResult,
	TreeNode,
} from './lib/types';

export {};

declare global {
	interface WailsAppBindings {
		CreateBookmarkFile(): Promise<string>;
		GetFilePath(): Promise<string>;
		LoadBookmarkFile(path: string): Promise<void>;
		OpenFilePicker(): Promise<string>;
		OpenImportFilePicker(): Promise<string>;
	}

	interface WailsMergePreview {
		foldersToAdd: FolderMergeItem[];
		bookmarksToAdd: BookmarkMergeItem[];
		duplicateBookmarks: BookmarkMergeItem[];
		potentialUpdates: BookmarkConflictItem[];
	}

	interface WailsHandlerBindings {
		AddBookmark(parentId: string, bookmark: BookmarkCreate): Promise<string>;
		ApplyImportMerge(path: string): Promise<MergeApplyResult>;
		AddFolder(parentId: string, name: string): Promise<string>;
		DeleteNode(id: string): Promise<void>;
		DeleteNodes(ids: string[]): Promise<void>;
		FetchFavicon(url: string): Promise<string>;
		FetchFaviconsForNodes(ids: string[]): Promise<void>;
		FetchPageTitle(url: string): Promise<string>;
		FilePath(): Promise<string>;
		GetAllFolders(): Promise<TreeNode[]>;
		GetFlatIndex(): Promise<BookmarkIndexEntry[]>;
		GetTree(): Promise<TreeNode[]>;
		LoadFile(path: string): Promise<void>;
		MoveNode(nodeId: string, newParentId: string, newIndex: number): Promise<void>;
		MoveNodes(nodeIds: string[], targetFolderId: string): Promise<void>;
		OpenURL(url: string): Promise<void>;
		PreviewImportMerge(path: string): Promise<WailsMergePreview>;
		RefreshTitlesForNodes(ids: string[]): Promise<void>;
		UpdateBookmark(id: string, patch: BookmarkPatch): Promise<void>;
		UpdateFolderName(id: string, name: string): Promise<void>;
	}

	interface Window {
		go?: {
			main?: {
				App?: WailsAppBindings;
				Handler?: WailsHandlerBindings;
			};
			wailsapi?: {
				Handler?: WailsHandlerBindings;
			};
		};
		runtime?: unknown;
	}
}
