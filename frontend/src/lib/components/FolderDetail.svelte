<script>
	import { UpdateFolderName } from '../api.js';
	import { uiStore } from '../stores/uiStore.svelte.js';
	import AddBookmarkForm from './AddBookmarkForm.svelte';
	import AddFolderForm from './AddFolderForm.svelte';

	let { folder } = $props();
	let editing = $state(false);
	let editName = $state('');
	let showAddBookmark = $state(false);
	let showAddFolder = $state(false);

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
			await UpdateFolderName(folder.id, editName.trim());
			uiStore.showToast('Folder renamed', 'success');
		}
		editing = false;
	}
</script>

<div class="h-full flex flex-col">
	<div class="bg-base-200 p-4">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-warning mb-2" viewBox="0 0 20 20" fill="currentColor">
			<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
		</svg>
		{#if editing}
			<input
				type="text"
				bind:value={editName}
				class="input input-bordered input-sm w-full mb-2"
				onkeydown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') editing = false; }}
			/>
			<div class="flex gap-2">
				<button class="btn btn-sm btn-primary" onclick={saveName}>Save</button>
				<button class="btn btn-sm btn-ghost" onclick={() => editing = false}>Cancel</button>
			</div>
		{:else}
			<h2 class="text-lg font-semibold">{folder.folder.name}</h2>
			<p class="text-xs opacity-50 mt-1">
				{folder.folder.children.length} item{folder.folder.children.length !== 1 ? 's' : ''}
			</p>
			{#if folder.folder.addDate}
				<p class="text-xs opacity-40 mt-1">Created: {new Date(folder.folder.addDate).toLocaleDateString()}</p>
			{/if}
			<div class="mt-3">
				<button class="btn btn-sm btn-ghost" onclick={() => { editing = true; }}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
					Rename
				</button>
			</div>
		{/if}
	</div>

	<!-- Add buttons -->
	<div class="p-4 border-t border-base-300">
		{#if !showAddBookmark && !showAddFolder}
			<div class="flex gap-2">
				<button class="btn btn-sm btn-primary flex-1" onclick={() => showAddBookmark = true}>
					+ Bookmark
				</button>
				<button class="btn btn-sm btn-secondary flex-1" onclick={() => showAddFolder = true}>
					+ Folder
				</button>
			</div>
		{/if}
		{#if showAddBookmark}
			<AddBookmarkForm parentFolderId={folder.id} onAdded={() => showAddBookmark = false} />
		{/if}
		{#if showAddFolder}
			<AddFolderForm parentFolderId={folder.id} onAdded={() => showAddFolder = false} />
		{/if}
	</div>
</div>
