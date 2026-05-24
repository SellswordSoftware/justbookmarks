/// <reference types="svelte" />
/// <reference types="vite/client" />

import type {
	BookmarkCreate,
	BookmarkIndexEntry,
	BookmarkPatch,
	TreeNode,
} from './lib/types';

export {};

declare global {
	interface WailsAppBindings {
		GetFilePath(): Promise<string>;
		LoadBookmarkFile(path: string): Promise<void>;
		OpenFilePicker(): Promise<string>;
	}

	interface WailsHandlerBindings {
		AddBookmark(parentId: string, bookmark: BookmarkCreate): Promise<string>;
		AddFolder(parentId: string, name: string): Promise<string>;
		DeleteNode(id: string): Promise<void>;
		FetchFavicon(url: string): Promise<string>;
		FetchPageTitle(url: string): Promise<string>;
		FilePath(): Promise<string>;
		GetAllFolders(): Promise<TreeNode[]>;
		GetFlatIndex(): Promise<BookmarkIndexEntry[]>;
		GetTree(): Promise<TreeNode[]>;
		LoadFile(path: string): Promise<void>;
		MoveNode(nodeId: string, newParentId: string, newIndex: number): Promise<void>;
		OpenURL(url: string): Promise<void>;
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
