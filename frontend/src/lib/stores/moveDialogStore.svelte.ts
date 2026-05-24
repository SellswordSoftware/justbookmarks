import { treeStore } from './treeStore.svelte.ts';
import type { FolderNode, MoveDialogNode, MoveTarget, TreeNode } from '../types';
import { isFolderNode } from '../types';

let open = $state(false);
let nodeToMove = $state<MoveDialogNode | null>(null);
let folders = $state<MoveTarget[]>([]);
let selectedTarget = $state('');

function collectFolderTargets(nodes: TreeNode[], excludedId: string): MoveTarget[] {
	const result: MoveTarget[] = [];

	function visit(node: TreeNode, ancestorExcluded = false): void {
		if (!isFolderNode(node)) return;

		const isExcludedBranch = ancestorExcluded || node.id === excludedId;
		if (!isExcludedBranch) {
			result.push({ id: node.id, name: node.folder.name });
		}

		for (const child of node.folder.children) {
			visit(child, isExcludedBranch);
		}
	}

	for (const node of nodes) {
		visit(node);
	}

	return result;
}

function showMoveDialog(nodeId: string, nodeName: string): void {
	nodeToMove = { id: nodeId, name: nodeName };
	selectedTarget = '';
	folders = collectFolderTargets(treeStore.tree, nodeId);
	open = true;
}

function closeMoveDialog(): void {
	open = false;
	selectedTarget = '';
	nodeToMove = null;
	folders = [];
}

export const moveDialogStore = {
	get open(): boolean {
		return open;
	},
	get nodeToMove(): MoveDialogNode | null {
		return nodeToMove;
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
	closeMoveDialog,
};
