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
	let nameInputRef = $state<HTMLInputElement | undefined>(undefined);

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

	$effect(() => {
		if (!editing) return;

		queueMicrotask(() => {
			nameInputRef?.focus();
			nameInputRef?.select();
		});
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

	function handleRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			editing = false;
			return;
		}

		if (event.key === 'Enter' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
			event.preventDefault();
			void saveName();
		}
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
		moveDialogStore.showMoveDialog(folder.id, folder.folder.name, 'folder');
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
				bind:this={nameInputRef}
				type="text"
				bind:value={editName}
				data-keyboard-action="folder-name"
				class="input input-bordered input-sm w-full mb-2"
				onkeydown={handleRenameKeydown}
			/>
			<div class="flex gap-2">
				<button class="btn btn-sm btn-primary" data-keyboard-action="folder-save" onclick={saveName}>Save</button>
				<button class="btn btn-sm btn-ghost" data-keyboard-action="folder-cancel" onclick={() => editing = false}>Cancel</button>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-4">
				<div>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-warning mb-2" viewBox="0 0 20 20" fill="currentColor">
						<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
					</svg>
					<h2 class="text-lg font-semibold text-balance">{folder.folder.name}</h2>
					<p class="text-xs opacity-50 mt-1 tabular-nums">
						{folder.folder.children.length} item{folder.folder.children.length !== 1 ? 's' : ''}
					</p>
					{#if hasRealDate(folder.folder.addDate)}
						<p class="text-xs opacity-40 mt-1 tabular-nums">Created: {new Date(folder.folder.addDate).toLocaleDateString()}</p>
					{/if}
				</div>
				<div class="flex flex-wrap justify-end gap-2">
					<button class="btn btn-sm btn-ghost" data-keyboard-action="folder-edit" onclick={() => { editing = true; }}>Edit</button>
					<button class="btn btn-sm btn-ghost" data-keyboard-action="folder-move" onclick={showMoveDialog}>Move...</button>
					<button class="btn btn-sm btn-error btn-outline" data-keyboard-action="folder-delete" onclick={showDeleteConfirm} aria-label="Delete folder" title="Delete folder">Delete</button>
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
					data-keyboard-action="folder-add-bookmark"
					onclick={toggleAddBookmark}
				>
					Add Bookmark
				</button>
				<button
					class={`btn btn-sm ${showAddFolder ? 'btn-secondary' : 'btn-outline btn-secondary'}`}
					data-keyboard-action="folder-add-folder"
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
