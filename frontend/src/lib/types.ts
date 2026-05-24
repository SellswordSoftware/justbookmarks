export const FOLDER_NODE_TYPE = 0;
export const BOOKMARK_NODE_TYPE = 1;

export type NodeType = typeof FOLDER_NODE_TYPE | typeof BOOKMARK_NODE_TYPE;
export type TimestampValue = string;

export interface BookmarkData {
	id: string;
	title: string;
	url: string;
	icon: string;
	iconURI: string;
	addDate: TimestampValue;
	lastModified: TimestampValue;
	meta: string;
}

export interface BookmarkCreate {
	title: string;
	url: string;
	icon?: string;
	iconURI?: string;
	meta?: string;
}

export interface BookmarkPatch {
	title?: string;
	url?: string;
	icon?: string;
	iconURI?: string;
	meta?: string;
}

export interface FolderData {
	id: string;
	name: string;
	icon: string;
	addDate: TimestampValue;
	lastModified: TimestampValue;
	meta: string;
	children: TreeNode[];
}

export interface FolderNode {
	type: typeof FOLDER_NODE_TYPE;
	id: string;
	folder: FolderData;
}

export interface BookmarkNode {
	type: typeof BOOKMARK_NODE_TYPE;
	id: string;
	bookmark: BookmarkData;
}

export type TreeNode = FolderNode | BookmarkNode;

export interface BookmarkIndexEntry {
	nodeId: string;
	title: string;
	url: string;
	folderPath: string;
}

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export type ConfirmCallback = (() => void | Promise<void>) | null;

export interface ConfirmModalState {
	open: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: ConfirmCallback;
}

export interface MoveTarget {
	id: string;
	name: string;
	depth: number;
	pathLabel: string;
}

export interface MoveDialogNode {
	id: string;
	name: string;
}

export interface MoveDialogRequest {
	nodeIds: string[];
	label: string;
	type: 'bookmark' | 'folder';
}

export interface VisibleTreeNodeEntry {
	id: string;
	node: TreeNode;
	depth: number;
	parentId: string;
}

export function isFolderNode(node: TreeNode): node is FolderNode {
	return node.type === FOLDER_NODE_TYPE;
}

export function isBookmarkNode(node: TreeNode): node is BookmarkNode {
	return node.type === BOOKMARK_NODE_TYPE;
}
