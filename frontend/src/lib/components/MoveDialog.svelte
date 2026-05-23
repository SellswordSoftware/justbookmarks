<script>
	import { GetAllFolders, MoveNode } from '../api.js';
	import { treeStore } from '../stores/treeStore.svelte.js';
	import { uiStore } from '../stores/uiStore.svelte.js';

	let nodeToMove; // { id, name }
	let open = $state(false);
	let folders = $state([]);
	let selectedTarget = $state('');
	let loading = $state(false);

	export async function showMoveDialog(nodeId, nodeName) {
		nodeToMove = { id: nodeId, name: nodeName };
		open = true;
		loading = true;
		selectedTarget = '';
		try {
			folders = await GetAllFolders();
			// Filter out the node itself and its descendants
			folders = folders.filter((f) => f.id !== nodeId);
		} catch (e) {
			uiStore.showToast('Failed to load folders: ' + e.message, 'error');
			open = false;
		} finally {
			loading = false;
		}
	}

	async function move() {
		if (!selectedTarget) return;
		try {
			await MoveNode(nodeToMove.id, selectedTarget, -1);
			uiStore.showToast('Moved successfully', 'success');
			treeStore.refresh();
		} catch (e) {
			uiStore.showToast('Move failed: ' + e.message, 'error');
		}
		open = false;
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => open = false}>
		<div class="bg-base-100 rounded-lg shadow-xl p-6 w-full max-w-md" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-lg font-bold mb-2">Move "{nodeToMove?.name}"</h3>
			<p class="text-sm opacity-60 mb-4">Select a target folder:</p>

			{#if loading}
				<div class="flex justify-center py-4">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{:else}
				<select
					bind:value={selectedTarget}
					class="select select-bordered w-full mb-4 max-h-60"
				>
					<option value="">-- Select folder --</option>
					{#each folders as folder}
						<option value={folder.id}>{folder.folder.name}</option>
					{/each}
				</select>
			{/if}

			<div class="flex justify-end gap-2">
				<button class="btn btn-sm btn-ghost" onclick={() => open = false}>Cancel</button>
				<button class="btn btn-sm btn-primary" onclick={move} disabled={!selectedTarget}>
					Move
				</button>
			</div>
		</div>
	</div>
{/if}
