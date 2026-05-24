import type { MoveDialogRequest, MoveTarget, TreeNode } from '../types';
import { isFolderNode } from '../types';
import { treeStore } from './treeStore.svelte.ts';

let open = $state(false);
let request = $state<MoveDialogRequest | null>(null);
let folders = $state<MoveTarget[]>([]);
let selectedTarget = $state('');

function collectFolderTargets(nodes: TreeNode[], excludedIds: string[]): MoveTarget[] {
	const result: MoveTarget[] = [];
	const excludedIdSet = new Set(excludedIds);

	function visit(
		node: TreeNode,
		insideExcludedBranch = false,
		depth = 0,
		parentPath = '',
	): void {
		if (!isFolderNode(node)) return;

		const isExcludedBranch = insideExcludedBranch || excludedIdSet.has(node.id);
		const pathLabel = parentPath ? `${parentPath} / ${node.folder.name}` : node.folder.name;
		if (!isExcludedBranch) {
			result.push({
				id: node.id,
				name: node.folder.name,
				depth,
				pathLabel,
			});
		}

		for (const child of node.folder.children) {
			visit(child, isExcludedBranch, depth + 1, pathLabel);
		}
	}

	for (const node of nodes) {
		visit(node);
	}

	return result;
}

function openDialog(nextRequest: MoveDialogRequest): void {
	request = nextRequest;
	selectedTarget = '';
	const excludedIds = nextRequest.type === 'folder' ? nextRequest.nodeIds : [];
	folders = collectFolderTargets(treeStore.tree, excludedIds);
	open = true;
}

function showMoveDialog(nodeId: string, nodeName: string, type: 'bookmark' | 'folder'): void {
	openDialog({
		nodeIds: [nodeId],
		label: nodeName,
		type,
	});
}

function showBulkMoveDialog(nodeIds: string[], type: 'bookmark' | 'folder'): void {
	const count = nodeIds.length;
	const label = `${count} ${type}${count === 1 ? '' : 's'}`;
	openDialog({
		nodeIds: [...nodeIds],
		label,
		type,
	});
}

function closeMoveDialog(): void {
	open = false;
	selectedTarget = '';
	request = null;
	folders = [];
}

export const moveDialogStore = {
	get open(): boolean {
		return open;
	},
	get request(): MoveDialogRequest | null {
		return request;
	},
	get folders(): MoveTarget[] {
		return folders;
	},
	get selectedTarget(): string {
		return selectedTarget;
	},
	setSelectedTarget(targetId: string): void {
		selectedTarget = targetId;
	},
	showMoveDialog,
	showBulkMoveDialog,
	closeMoveDialog,
};
