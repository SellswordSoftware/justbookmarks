<script lang="ts">
	import { MoveNode } from '../api';
	import { getErrorMessage } from '../errors';
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import type { TreeNode as BookmarkTreeNode } from '../types';
	import { isFolderNode } from '../types';
	import TreeNode from './TreeNode.svelte';

	interface Props {
		node: BookmarkTreeNode;
		depth?: number;
	}

	let { node, depth = 0 }: Props = $props();
	const nodeId = $derived(node.id);
	const childNodes = $derived(isFolderNode(node) ? node.folder.children : []);
	const folderPaddingLeft = $derived(`${depth * 16 + 8}px`);
	const bookmarkPaddingLeft = $derived(`${depth * 16 + 24}px`);
	const isPrimarySelected = $derived(treeStore.primarySelectedNodeId === nodeId);
	const isSelected = $derived(treeStore.isSelected(nodeId));
	const multiSelectActive = $derived(treeStore.selectionCount > 1);

	let isDragOver = $state(false);
	let isDragging = $state(false);
	let dropPosition = $state<'before' | 'after' | 'inside' | ''>('');

	function selectFromEvent(event: MouseEvent): void {
		if (event.shiftKey) {
			const changed = treeStore.selectRange(nodeId, treeStore.getVisibleNodeIds());
			if (!changed) {
				uiStore.showToast('Range selection must stay within the same sibling group', 'warning');
			}
			return;
		}

		if (event.metaKey || event.ctrlKey) {
			const changed = treeStore.toggleSelected(nodeId);
			if (!changed) {
				uiStore.showToast('Multi-select only supports matching sibling bookmarks or folders', 'warning');
			}
			return;
		}

		treeStore.selectSingle(nodeId);
	}

	function rowClass(baseClass: string, activeDropClass: string): string {
		return [
			baseClass,
			isPrimarySelected ? 'bg-primary text-primary-content shadow-sm' : '',
			!isPrimarySelected && isSelected ? 'bg-primary/18 text-primary' : '',
			!isSelected ? 'hover:bg-base-200' : '',
			isDragOver && activeDropClass ? activeDropClass : '',
			isDragging ? 'opacity-40' : '',
		]
			.filter(Boolean)
			.join(' ');
	}

	function handleDragStart(event: DragEvent): void {
		if (multiSelectActive) {
			event.preventDefault();
			return;
		}

		isDragging = true;
		event.dataTransfer?.setData('text/plain', nodeId);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragEnd() {
		isDragging = false;
	}

	function handleDragOver(event: DragEvent): void {
		if (multiSelectActive) return;

		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		isDragOver = true;
		const currentTarget = event.currentTarget;
		if (!(currentTarget instanceof HTMLElement)) return;
		const rect = currentTarget.getBoundingClientRect();
		const relY = (event.clientY - rect.top) / rect.height;
		if (isFolderNode(node)) {
			if (relY < 0.25) {
				dropPosition = 'before';
			} else if (relY > 0.75) {
				dropPosition = 'after';
			} else {
				dropPosition = 'inside';
			}
		} else {
			dropPosition = relY < 0.5 ? 'before' : 'after';
		}
	}

	function handleDragLeave() {
		isDragOver = false;
		dropPosition = '';
	}

	async function handleDrop(event: DragEvent): Promise<void> {
		if (multiSelectActive) return;

		event.preventDefault();
		isDragOver = false;
		const targetPosition = dropPosition;
		dropPosition = '';
		const draggedId = event.dataTransfer?.getData('text/plain') ?? '';
		if (!draggedId || draggedId === nodeId) return;

		let newParentId = '';
		let newIndex = -1;

		if (isFolderNode(node) && targetPosition === 'inside') {
			newParentId = nodeId;
			newIndex = -1;
		} else {
			const parent = treeStore.getParentNode(nodeId);
			if (!parent) {
				uiStore.showToast('Reordering at the root level is not supported yet', 'error');
				return;
			}

			const siblingIndex = treeStore.getChildIndex(parent.id, nodeId);
			if (siblingIndex < 0) {
				uiStore.showToast('Move failed: could not resolve target position', 'error');
				return;
			}

			newParentId = parent.id;
			newIndex = targetPosition === 'before' ? siblingIndex : siblingIndex + 1;
		}

		try {
			await MoveNode(draggedId, newParentId, newIndex);
			await treeStore.refresh();
		} catch (caughtError: unknown) {
			uiStore.showToast(getErrorMessage(caughtError, 'Move failed'), 'error');
		}
	}

	function handleRowKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			treeStore.selectSingle(nodeId);
			return;
		}

		if (event.key === ' ') {
			event.preventDefault();
			if (isFolderNode(node)) {
				treeStore.toggleExpand(nodeId);
			} else {
				treeStore.selectSingle(nodeId);
			}
		}
	}
</script>

{#if isFolderNode(node)}
	<div>
		{#if isDragOver && dropPosition === 'before'}
			<div class="mx-2 h-0.5 rounded-full bg-secondary"></div>
		{/if}
		<div
			class={rowClass(
				'tree-row flex items-center gap-1 rounded-md px-2 py-1 select-none cursor-pointer transition-colors',
				dropPosition === 'inside' ? 'bg-secondary/20 border-2 border-dashed border-secondary' : ''
			)}
			role="treeitem"
			aria-expanded={treeStore.isExpanded(nodeId)}
			aria-selected={isSelected}
			tabindex="-1"
			style:padding-left={folderPaddingLeft}
			onclick={selectFromEvent}
			onkeydown={handleRowKeydown}
			draggable={!multiSelectActive}
			ondragstart={handleDragStart}
			ondragend={handleDragEnd}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			<button
				class="btn btn-ghost btn-xs inline-flex h-4 min-h-0 items-center justify-center p-0"
				onclick={(event: MouseEvent) => {
					event.stopPropagation();
					treeStore.toggleExpand(nodeId);
				}}
			>
				{#if treeStore.isExpanded(nodeId)}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				{/if}
			</button>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
				{#if treeStore.isExpanded(nodeId)}
					<path d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z" />
				{:else}
					<path d="M128 512L512 512C547.3 512 576 483.3 576 448L576 208C576 172.7 547.3 144 512 144L362.7 144C355.8 144 349 141.8 343.5 137.6L305.1 108.8C294 100.5 280.5 96 266.7 96L128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512z" />
				{/if}
			</svg>
			<span class="truncate text-sm">{node.folder.name}</span>
			<span class="ml-1 text-xs opacity-40">({childNodes.length})</span>
		</div>
		{#if isDragOver && dropPosition === 'after'}
			<div class="mx-2 h-0.5 rounded-full bg-secondary"></div>
		{/if}
		{#if treeStore.isExpanded(nodeId)}
			{#each childNodes as child (child.id)}
				<TreeNode node={child} depth={depth + 1} />
			{/each}
		{/if}
	</div>
{:else}
	<div
		class={rowClass(
			'tree-row relative flex items-center gap-2 rounded-md px-2 py-1 select-none cursor-pointer transition-colors',
			'bg-secondary/10'
		)}
		role="treeitem"
		aria-selected={isSelected}
		tabindex="-1"
		style:padding-left={bookmarkPaddingLeft}
		onclick={selectFromEvent}
		onkeydown={handleRowKeydown}
		draggable={!multiSelectActive}
		ondragstart={handleDragStart}
		ondragend={handleDragEnd}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		{#if isDragOver && dropPosition === 'before'}
			<div class="absolute inset-x-0 top-0 h-0.5 rounded-full bg-secondary"></div>
		{/if}
		{#if node.bookmark.icon}
			<img src={node.bookmark.icon} alt="" class="h-4 w-4 shrink-0" />
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
				<path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
			</svg>
		{/if}
		<span class="truncate text-sm">{node.bookmark.title || node.bookmark.url}</span>
		{#if isDragOver && dropPosition === 'after'}
			<div class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-secondary"></div>
		{/if}
	</div>
{/if}
