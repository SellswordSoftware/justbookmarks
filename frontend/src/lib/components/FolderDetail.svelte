<script lang="ts">
	import { DeleteNode, UpdateFolderName } from '../api';
	import { getErrorMessage } from '../errors';
	import { moveDialogStore } from '../stores/moveDialogStore.svelte.ts';
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import AddBookmarkForm from './AddBookmarkForm.svelte';
	import AddFolderForm from './AddFolderForm.svelte';
	import type { FolderNode } from '../types';

	interface Props {
		folder: FolderNode;
	}

	let { folder }: Props = $props();
	let editing = $state(false);
	let editName = $state('');
	let showAddBookmark = $state(false);
	let showAddFolder = $state(false);

	function hasRealDate(value: string): boolean {
		return Boolean(value) && !String(value).startsWith('0001-01-01');
	}

	$effect(() => {
		if (folder) {
			editName = folder.folder.name;
			editing = false;
			showAddBookmark = false;
			showAddFolder = false;
		}
	});

	async function saveName() {
		if (editName.trim() && editName !== folder.folder.name) {
			try {
				await UpdateFolderName(folder.id, editName.trim());
				await treeStore.refresh();
				uiStore.showToast('Folder renamed', 'success');
			} catch (caughtError: unknown) {
				uiStore.showToast(getErrorMessage(caughtError, 'Failed to rename folder'), 'error');
			}
		}
		editing = false;
	}

	function toggleAddBookmark() {
		showAddBookmark = !showAddBookmark;
		if (showAddBookmark) {
			showAddFolder = false;
		}
	}

	function toggleAddFolder() {
		showAddFolder = !showAddFolder;
		if (showAddFolder) {
			showAddBookmark = false;
		}
	}

	function showMoveDialog() {
		moveDialogStore.showMoveDialog(folder.id, folder.folder.name);
	}

	function showDeleteConfirm() {
		uiStore.showConfirm(
			'Delete Folder',
			`Delete "${folder.folder.name}" and all of its contents?`,
			'Delete',
			async () => {
				try {
					await DeleteNode(folder.id);
					treeStore.clearSelection();
					await treeStore.refresh();
					uiStore.showToast('Folder deleted', 'success');
				} catch (caughtError: unknown) {
					uiStore.showToast(getErrorMessage(caughtError, 'Failed to delete folder'), 'error');
				}
			}
		);
	}
</script>

<div class="h-full flex flex-col">
	<div class="bg-base-200 p-4">
		{#if editing}
			<input
				type="text"
				bind:value={editName}
				class="input input-bordered input-sm w-full mb-2"
				onkeydown={(event: KeyboardEvent) => { if (event.key === 'Enter') saveName(); if (event.key === 'Escape') editing = false; }}
			/>
			<div class="flex gap-2">
				<button class="btn btn-sm btn-primary" onclick={saveName}>Save</button>
				<button class="btn btn-sm btn-ghost" onclick={() => editing = false}>Cancel</button>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-4">
				<div>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-warning mb-2" viewBox="0 0 20 20" fill="currentColor">
						<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
					</svg>
					<h2 class="text-lg font-semibold">{folder.folder.name}</h2>
					<p class="text-xs opacity-50 mt-1">
						{folder.folder.children.length} item{folder.folder.children.length !== 1 ? 's' : ''}
					</p>
					{#if hasRealDate(folder.folder.addDate)}
						<p class="text-xs opacity-40 mt-1">Created: {new Date(folder.folder.addDate).toLocaleDateString()}</p>
					{/if}
				</div>
				<div class="flex flex-wrap justify-end gap-2">
					<button class="btn btn-sm btn-ghost" onclick={() => { editing = true; }}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
						Rename
					</button>
					<button class="btn btn-sm btn-ghost" onclick={showMoveDialog}>Move To...</button>
					<button class="btn btn-sm btn-error btn-outline" onclick={showDeleteConfirm} aria-label="Delete folder" title="Delete folder">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
							<path d="M262.2 48C248.9 48 236.9 56.3 232.2 68.8L216 112L120 112C106.7 112 96 122.7 96 136C96 149.3 106.7 160 120 160L520 160C533.3 160 544 149.3 544 136C544 122.7 533.3 112 520 112L424 112L407.8 68.8C403.1 56.3 391.2 48 377.8 48L262.2 48zM128 208L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 208L464 208L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 208L128 208zM288 280C288 266.7 277.3 256 264 256C250.7 256 240 266.7 240 280L240 456C240 469.3 250.7 480 264 480C277.3 480 288 469.3 288 456L288 280zM400 280C400 266.7 389.3 256 376 256C362.7 256 352 266.7 352 280L352 456C352 469.3 362.7 480 376 480C389.3 480 400 469.3 400 456L400 280z" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</div>

	<div class="p-4 border-t border-base-300 space-y-3">
		<div class="flex items-center justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold">Add Items</h3>
				<p class="text-xs opacity-50">Create new entries inside this folder.</p>
			</div>
			<div class="flex gap-2">
				<button
					class={`btn btn-sm ${showAddBookmark ? 'btn-primary' : 'btn-outline btn-primary'}`}
					onclick={toggleAddBookmark}
				>
					Add Bookmark
				</button>
				<button
					class={`btn btn-sm ${showAddFolder ? 'btn-secondary' : 'btn-outline btn-secondary'}`}
					onclick={toggleAddFolder}
				>
					Add Folder
				</button>
			</div>
		</div>

		{#if showAddBookmark}
			<AddBookmarkForm parentFolderId={folder.id} onAdded={() => showAddBookmark = false} />
		{/if}
		{#if showAddFolder}
			<AddFolderForm parentFolderId={folder.id} onAdded={() => showAddFolder = false} />
		{/if}
	</div>
</div>
