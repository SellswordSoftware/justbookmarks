import { GetFlatIndex, GetTree, LoadFile } from '../api';
import { getErrorMessage } from '../errors';
import { isFolderNode, type FolderNode, type TreeNode, type VisibleTreeNodeEntry } from '../types';
import { searchStore } from './searchStore.svelte.ts';
import type { PerFileTreeState } from '../persistence';

type RawBookmarkNode = {
	type: 1;
	bookmark?: {
		id?: string;
		title?: string;
		url?: string;
		icon?: string;
		iconURI?: string;
		addDate?: string;
		lastModified?: string;
		meta?: string;
	};
};

type RawFolderNode = {
	type: 0;
	folder?: {
		id?: string;
		name?: string;
		icon?: string;
		addDate?: string;
		lastModified?: string;
		meta?: string;
		children?: RawTreeNode[];
	};
};

type RawTreeNode = RawFolderNode | RawBookmarkNode;

let tree = $state<TreeNode[]>([]);
let primarySelectedNodeId = $state('');
let selectedNodeIds = $state<string[]>([]);
let selectionAnchorNodeId = $state('');
let expandedNodeIds = $state<string[]>([]);
let loading = $state(false);
let error = $state('');

export interface SelectionSnapshot {
	selectedNodeIds: string[];
	primaryNodeId: string;
	ancestorIds: string[];
}

function normalizeTree(nodes: RawTreeNode[] | undefined): TreeNode[] {
	if (!Array.isArray(nodes)) {
		return [];
	}

	return nodes.map((node) => normalizeNode(node)).filter((node): node is TreeNode => node !== null);
}

function normalizeNode(node: RawTreeNode | null | undefined): TreeNode | null {
	if (!node) return null;

	if (node.type === 0 && node.folder?.id) {
		return {
			type: 0,
			id: node.folder.id,
			folder: {
				id: node.folder.id,
				name: node.folder.name ?? '',
				icon: node.folder.icon ?? '',
				addDate: node.folder.addDate ?? '',
				lastModified: node.folder.lastModified ?? '',
				meta: node.folder.meta ?? '',
				children: normalizeTree(node.folder.children),
			},
		};
	}

	if (node.type === 1 && node.bookmark?.id) {
		return {
			type: 1,
			id: node.bookmark.id,
			bookmark: {
				id: node.bookmark.id,
				title: node.bookmark.title ?? '',
				url: node.bookmark.url ?? '',
				icon: node.bookmark.icon ?? '',
				iconURI: node.bookmark.iconURI ?? '',
				addDate: node.bookmark.addDate ?? '',
				lastModified: node.bookmark.lastModified ?? '',
				meta: node.bookmark.meta ?? '',
			},
		};
	}

	return null;
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

function getNode(id: string): TreeNode | null {
	return findNode(tree, id);
}

function getNodeType(id: string): TreeNode['type'] | null {
	const node = getNode(id);
	return node?.type ?? null;
}

function getParentNode(id: string): FolderNode | null {
	return findParentNode(tree, id);
}

function getParentId(id: string): string {
	return getParentNode(id)?.id ?? '';
}

function getChildIndex(parentId: string, childId: string): number {
	const parent = getNode(parentId);
	if (!parent || !isFolderNode(parent)) return -1;

	return parent.folder.children.findIndex((child) => child.id === childId);
}

function isSelected(id: string): boolean {
	return selectedNodeIds.includes(id);
}

function getPrimarySelectedNode(): TreeNode | null {
	return primarySelectedNodeId ? getNode(primarySelectedNodeId) : null;
}

function getSelectedNodes(): TreeNode[] {
	return selectedNodeIds
		.map((id) => getNode(id))
		.filter((node): node is TreeNode => node !== null);
}

function canJoinSelection(candidateId: string): boolean {
	if (!candidateId) return false;
	const anchorId = selectionAnchorNodeId || primarySelectedNodeId || selectedNodeIds[0] || '';
	if (!anchorId) return Boolean(getNode(candidateId));

	const anchorNode = getNode(anchorId);
	const candidateNode = getNode(candidateId);
	if (!anchorNode || !candidateNode) return false;

	return anchorNode.type === candidateNode.type && getParentId(anchorId) === getParentId(candidateId);
}

function setPrimarySelected(id: string): void {
	if (!id || !selectedNodeIds.includes(id)) return;
	primarySelectedNodeId = id;
}

function clearSelection(): void {
	primarySelectedNodeId = '';
	selectedNodeIds = [];
	selectionAnchorNodeId = '';
}

function getAncestorIds(id: string): string[] {
	const ancestors: string[] = [];
	let currentId = id;

	while (currentId) {
		const parentId = getParentId(currentId);
		if (!parentId) break;
		ancestors.push(parentId);
		currentId = parentId;
	}

	return ancestors;
}

function selectSingle(id: string): void {
	if (!getNode(id)) {
		clearSelection();
		return;
	}

	selectedNodeIds = [id];
	primarySelectedNodeId = id;
	selectionAnchorNodeId = id;
}

function toggleSelected(id: string): boolean {
	if (!getNode(id)) return false;

	if (selectedNodeIds.length === 0) {
		selectSingle(id);
		return true;
	}

	if (!canJoinSelection(id)) {
		return false;
	}

	if (isSelected(id)) {
		selectedNodeIds = selectedNodeIds.filter((selectedId) => selectedId !== id);
		if (selectedNodeIds.length === 0) {
			clearSelection();
			return true;
		}

		if (primarySelectedNodeId === id) {
			primarySelectedNodeId = selectedNodeIds[0];
		}

		return true;
	}

	selectedNodeIds = [...selectedNodeIds, id];
	primarySelectedNodeId = id;
	if (!selectionAnchorNodeId) {
		selectionAnchorNodeId = selectedNodeIds[0];
	}
	return true;
}

function selectRange(targetId: string, visibleIds: string[]): boolean {
	if (!selectionAnchorNodeId) {
		selectSingle(targetId);
		return true;
	}

	if (!canJoinSelection(targetId)) {
		return false;
	}

	const anchorIndex = visibleIds.indexOf(selectionAnchorNodeId);
	const targetIndex = visibleIds.indexOf(targetId);
	if (anchorIndex < 0 || targetIndex < 0) {
		selectSingle(targetId);
		return true;
	}

	const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
	const rangeIds = visibleIds.slice(start, end + 1).filter((id) => canJoinSelection(id));
	if (rangeIds.length === 0) {
		return false;
	}

	selectedNodeIds = rangeIds;
	primarySelectedNodeId = targetId;
	return true;
}

function getSiblingIds(id: string): string[] {
	if (!id) return [];

	const parent = getParentNode(id);
	if (!parent) {
		return tree.map((node) => node.id);
	}

	return parent.folder.children.map((child) => child.id);
}

function selectSiblingRange(targetId: string): boolean {
	if (!targetId) return false;
	return selectRange(targetId, getSiblingIds(targetId));
}

function extendSelectionByOffset(offset: number): boolean {
	if (offset === 0) return false;

	const anchorId = selectionAnchorNodeId || primarySelectedNodeId || selectedNodeIds[0] || '';
	const pivotId = primarySelectedNodeId || selectedNodeIds[selectedNodeIds.length - 1] || anchorId;
	if (!anchorId || !pivotId) return false;

	const siblingIds = getSiblingIds(anchorId);
	const pivotIndex = siblingIds.indexOf(pivotId);
	if (pivotIndex < 0) return false;

	const nextIndex = Math.min(Math.max(pivotIndex + offset, 0), siblingIds.length - 1);
	if (nextIndex === pivotIndex) return false;

	return selectRange(siblingIds[nextIndex], siblingIds);
}

function selectAllSiblings(): boolean {
	const primaryId = primarySelectedNodeId || selectedNodeIds[0] || '';
	if (!primaryId) return false;

	const siblingIds = getSiblingIds(primaryId).filter((id) => canJoinSelection(id));
	if (siblingIds.length === 0) return false;

	selectedNodeIds = siblingIds;
	primarySelectedNodeId = siblingIds.includes(primaryId) ? primaryId : siblingIds[0];
	selectionAnchorNodeId = siblingIds[0];
	return true;
}

function collapseSelectionToPrimary(): void {
	if (!primarySelectedNodeId) {
		clearSelection();
		return;
	}

	selectedNodeIds = [primarySelectedNodeId];
	selectionAnchorNodeId = primarySelectedNodeId;
}

function expandAncestors(id: string): void {
	for (const ancestorId of getAncestorIds(id)) {
		if (!expandedNodeIds.includes(ancestorId)) {
			expandedNodeIds.push(ancestorId);
		}
	}
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

function getVisibleNodeEntries(nodes: TreeNode[] = tree, depth = 0, parentId = ''): VisibleTreeNodeEntry[] {
	const result: VisibleTreeNodeEntry[] = [];
	for (const node of nodes) {
		result.push({ id: node.id, node, depth, parentId });
		if (isFolderNode(node) && isExpanded(node.id)) {
			result.push(...getVisibleNodeEntries(node.folder.children ?? [], depth + 1, node.id));
		}
	}
	return result;
}

function getVisibleNodeIds(): string[] {
	return getVisibleNodeEntries().map((entry) => entry.id);
}

function getFolderNodeIds(nodes: TreeNode[] = tree): string[] {
	const result: string[] = [];
	for (const node of nodes) {
		if (!isFolderNode(node)) continue;
		result.push(node.id);
		result.push(...getFolderNodeIds(node.folder.children));
	}
	return result;
}

function pruneSelection(): void {
	const validIds = selectedNodeIds.filter((id) => Boolean(getNode(id)));
	selectedNodeIds = validIds;

	if (primarySelectedNodeId && !validIds.includes(primarySelectedNodeId)) {
		primarySelectedNodeId = validIds[0] ?? '';
	}

	if (selectionAnchorNodeId && !getNode(selectionAnchorNodeId)) {
		selectionAnchorNodeId = primarySelectedNodeId || validIds[0] || '';
	}

	if (validIds.length === 0) {
		clearSelection();
	}
}

async function syncTreeState(): Promise<void> {
	const [treeData, flatIndex] = await Promise.all([GetTree(), GetFlatIndex()]);
	tree = normalizeTree(treeData as RawTreeNode[]);
	searchStore.setIndex(flatIndex);
	pruneSelection();
}

async function loadFile(path: string): Promise<boolean> {
	loading = true;
	error = '';

	try {
		await LoadFile(path);
		expandedNodeIds = [];
		clearSelection();
		await syncTreeState();
		expandedNodeIds = tree.filter(isFolderNode).map((node) => node.id);
		return true;
	} catch (caughtError: unknown) {
		error = getErrorMessage(caughtError, 'Failed to load bookmark file');
		return false;
	} finally {
		loading = false;
	}
}

function restoreUIState(state: PerFileTreeState | null | undefined): void {
	if (!state) return;

	const validFolderIds = new Set(getFolderNodeIds());
	const nextExpanded = state.expandedNodeIds.filter((id) => validFolderIds.has(id));
	expandedNodeIds = nextExpanded;

	if (state.selectedNodeId && getNode(state.selectedNodeId)) {
		selectSingle(state.selectedNodeId);
	} else {
		clearSelection();
	}
}

function getPersistentState(): PerFileTreeState {
	return {
		expandedNodeIds: [...expandedNodeIds],
		selectedNodeId: primarySelectedNodeId,
	};
}

function captureSelectionSnapshot(): SelectionSnapshot {
	const primaryNodeId = primarySelectedNodeId || selectedNodeIds[0] || '';
	return {
		selectedNodeIds: [...selectedNodeIds],
		primaryNodeId,
		ancestorIds: primaryNodeId ? getAncestorIds(primaryNodeId) : [],
	};
}

function restoreSelectionSnapshot(snapshot: SelectionSnapshot | null | undefined): void {
	if (!snapshot) {
		clearSelection();
		return;
	}

	const validSelected = snapshot.selectedNodeIds.filter((id) => Boolean(getNode(id)));
	if (validSelected.length > 1) {
		const firstNode = getNode(validSelected[0]);
		const sameTypeAndParent = firstNode
			? validSelected.every((id) => {
					const candidate = getNode(id);
					if (!candidate) {
						return false;
					}
					return candidate.type === firstNode.type && getParentId(id) === getParentId(validSelected[0]);
				})
			: false;

		if (sameTypeAndParent) {
			selectedNodeIds = validSelected;
			primarySelectedNodeId = validSelected.includes(snapshot.primaryNodeId) ? snapshot.primaryNodeId : validSelected[0];
			selectionAnchorNodeId = validSelected[0];
			return;
		}
	}

	if (snapshot.primaryNodeId && getNode(snapshot.primaryNodeId)) {
		selectSingle(snapshot.primaryNodeId);
		return;
	}

	for (const ancestorId of snapshot.ancestorIds) {
		if (getNode(ancestorId)) {
			selectSingle(ancestorId);
			return;
		}
	}

	if (validSelected[0]) {
		selectSingle(validSelected[0]);
		return;
	}

	clearSelection();
}

async function refresh(): Promise<void> {
	await syncTreeState();
}

export const treeStore = {
	get tree(): TreeNode[] {
		return tree;
	},
	get selectedNodeId(): string {
		return primarySelectedNodeId;
	},
	get primarySelectedNodeId(): string {
		return primarySelectedNodeId;
	},
	get selectedNodeIds(): string[] {
		return selectedNodeIds;
	},
	get selectionAnchorNodeId(): string {
		return selectionAnchorNodeId;
	},
	get selectionCount(): number {
		return selectedNodeIds.length;
	},
	get hasMultiSelection(): boolean {
		return selectedNodeIds.length > 1;
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
	selectNode: selectSingle,
	selectSingle,
	toggleSelected,
	selectRange,
	clearSelection,
	setPrimarySelected,
	toggleExpand,
	isExpanded,
	isSelected,
	getNode,
	getNodeType,
	getParentNode,
	getParentId,
	getChildIndex,
	getSelectedNodes,
	getPrimarySelectedNode,
	canJoinSelection,
	getSiblingIds,
	selectSiblingRange,
	extendSelectionByOffset,
	selectAllSiblings,
	collapseSelectionToPrimary,
	expandAncestors,
	getVisibleNodeEntries,
	getVisibleNodeIds,
	restoreUIState,
	captureSelectionSnapshot,
	restoreSelectionSnapshot,
	getPersistentState,
};
