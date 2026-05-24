import { GetFlatIndex, GetTree, LoadFile } from '../api';
import { searchStore } from './searchStore.svelte.ts';
import type { FolderNode, TreeNode } from '../types';
import { isFolderNode } from '../types';
import { getErrorMessage } from '../errors';

let tree = $state<TreeNode[]>([]);
let selectedNodeId = $state('');
let expandedNodeIds = $state<string[]>([]);
let loading = $state(false);
let error = $state('');

async function syncTreeState(): Promise<void> {
	const [treeData, flatIndex] = await Promise.all([GetTree(), GetFlatIndex()]);
	tree = treeData;
	searchStore.setIndex(flatIndex);

	if (selectedNodeId && !findNode(tree, selectedNodeId)) {
		selectedNodeId = '';
	}
}

async function loadFile(path: string): Promise<void> {
	loading = true;
	error = '';

	try {
		await LoadFile(path);
		expandedNodeIds = [];
		selectedNodeId = '';
		await syncTreeState();
		expandedNodeIds = tree.filter(isFolderNode).map((node) => node.id);
	} catch (caughtError: unknown) {
		error = getErrorMessage(caughtError, 'Failed to load bookmark file');
	} finally {
		loading = false;
	}
}

function selectNode(id: string): void {
	selectedNodeId = id;
}

function clearSelection(): void {
	selectedNodeId = '';
}

function toggleExpand(id: string): void {
	const index = expandedNodeIds.indexOf(id);
	if (index >= 0) {
		expandedNodeIds.splice(index, 1);
		return;
	}

	expandedNodeIds.push(id);
}

function isExpanded(id: string): boolean {
	return expandedNodeIds.includes(id);
}

function getNode(id: string): TreeNode | null {
	return findNode(tree, id);
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (isFolderNode(node)) {
			const found = findNode(node.folder.children, id);
			if (found) return found;
		}
	}

	return null;
}

function findParentNode(nodes: TreeNode[], childId: string): FolderNode | null {
	for (const node of nodes) {
		if (!isFolderNode(node)) continue;

		if (node.folder.children.some((child) => child.id === childId)) {
			return node;
		}

		const found = findParentNode(node.folder.children, childId);
		if (found) return found;
	}

	return null;
}

function getParentNode(id: string): FolderNode | null {
	return findParentNode(tree, id);
}

function getChildIndex(parentId: string, childId: string): number {
	const parent = getNode(parentId);
	if (!parent || !isFolderNode(parent)) return -1;

	return parent.folder.children.findIndex((child) => child.id === childId);
}

async function refresh(): Promise<void> {
	await syncTreeState();
}

export const treeStore = {
	get tree(): TreeNode[] {
		return tree;
	},
	get selectedNodeId(): string {
		return selectedNodeId;
	},
	get expandedNodeIds(): string[] {
		return expandedNodeIds;
	},
	get loading(): boolean {
		return loading;
	},
	get error(): string {
		return error;
	},
	loadFile,
	refresh,
	selectNode,
	clearSelection,
	toggleExpand,
	isExpanded,
	getNode,
	getParentNode,
	getChildIndex,
};
