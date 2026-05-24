<script lang="ts">
	import { DeleteNodes, FetchFaviconsForNodes, RefreshTitlesForNodes } from '../api';
	import { getErrorMessage } from '../errors';
	import { moveDialogStore } from '../stores/moveDialogStore.svelte.ts';
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import { isFolderNode } from '../types';

	const selectedNodes = $derived(treeStore.getSelectedNodes());
	const firstNode = $derived(selectedNodes[0] ?? null);
	const isFolderSelection = $derived(Boolean(firstNode && isFolderNode(firstNode)));
	const selectionLabel = $derived(isFolderSelection ? 'Folders' : 'Bookmarks');
	const selectionCount = $derived(selectedNodes.length);
	const parentId = $derived(firstNode ? treeStore.getParentId(firstNode.id) : '');
	const parentNode = $derived(parentId ? treeStore.getNode(parentId) : null);
	const parentLabel = $derived(parentNode && isFolderNode(parentNode) ? parentNode.folder.name : 'Root');
	let runningAction = $state<'delete' | 'move' | 'favicons' | 'titles' | ''>('');

	async function refreshAfterAction(message: string): Promise<void> {
		await treeStore.refresh();
		uiStore.showToast(message, 'success');
	}

	function openMoveDialog(): void {
		moveDialogStore.showBulkMoveDialog(
			treeStore.selectedNodeIds,
			isFolderSelection ? 'folder' : 'bookmark',
		);
	}

	function confirmDelete(): void {
		uiStore.showConfirm(
			`Delete ${selectionLabel}`,
			`Delete ${selectionCount} selected ${selectionLabel.toLowerCase()}?`,
			'Delete',
			async () => {
				runningAction = 'delete';
				try {
					await DeleteNodes(treeStore.selectedNodeIds);
					treeStore.clearSelection();
					await refreshAfterAction(`${selectionCount} ${selectionLabel.toLowerCase()} deleted`);
				} catch (caughtError: unknown) {
					uiStore.showToast(getErrorMessage(caughtError, 'Bulk delete failed'), 'error');
				} finally {
					runningAction = '';
				}
			},
		);
	}

	async function fetchFavicons(): Promise<void> {
		runningAction = 'favicons';
		try {
			await FetchFaviconsForNodes(treeStore.selectedNodeIds);
			await refreshAfterAction('Favicons refreshed');
		} catch (caughtError: unknown) {
			uiStore.showToast(getErrorMessage(caughtError, 'Bulk favicon refresh failed'), 'error');
		} finally {
			runningAction = '';
		}
	}

	async function refreshTitles(): Promise<void> {
		runningAction = 'titles';
		try {
			await RefreshTitlesForNodes(treeStore.selectedNodeIds);
			await refreshAfterAction('Titles refreshed');
		} catch (caughtError: unknown) {
			uiStore.showToast(getErrorMessage(caughtError, 'Bulk title refresh failed'), 'error');
		} finally {
			runningAction = '';
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="bg-base-200 p-4">
		<div class="mb-3 flex items-start justify-between gap-4">
			<div>
				<p class="text-xs font-medium uppercase tracking-[0.12em] opacity-45">Bulk Selection</p>
				<h2 class="text-lg font-semibold">{selectionCount} {selectionLabel}</h2>
				<p class="mt-1 text-xs opacity-55">Sibling group: {parentLabel}</p>
			</div>
			<button class="btn btn-sm btn-ghost" onclick={() => treeStore.clearSelection()}>Clear</button>
		</div>
		<div class="flex flex-wrap gap-2">
			<button class="btn btn-sm btn-primary" onclick={openMoveDialog} disabled={runningAction !== ''}>
				Move
			</button>
			<button class="btn btn-sm btn-error btn-outline" onclick={confirmDelete} disabled={runningAction !== ''}>
				Delete
			</button>
			{#if !isFolderSelection}
				<button class="btn btn-sm btn-ghost" onclick={fetchFavicons} disabled={runningAction !== ''}>
					{#if runningAction === 'favicons'}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						Fetch Favicons
					{/if}
				</button>
				<button class="btn btn-sm btn-ghost" onclick={refreshTitles} disabled={runningAction !== ''}>
					{#if runningAction === 'titles'}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						Refresh Titles
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<div class="border-t border-base-300 p-4">
		<p class="text-sm opacity-70">
			Bulk actions operate on the current sibling selection and save once when the command completes.
		</p>
	</div>
</div>
