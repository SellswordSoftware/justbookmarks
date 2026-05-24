<script lang="ts">
	import { MoveNode } from '../api';
	import { getErrorMessage } from '../errors';
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { moveDialogStore } from '../stores/moveDialogStore.svelte.ts';
	import { uiStore } from '../stores/uiStore.svelte.ts';

	async function move() {
		const nodeToMove = moveDialogStore.nodeToMove;
		if (!moveDialogStore.selectedTarget || !nodeToMove) return;
		try {
			await MoveNode(nodeToMove.id, moveDialogStore.selectedTarget, -1);
			uiStore.showToast('Moved successfully', 'success');
			await treeStore.refresh();
		} catch (caughtError: unknown) {
			uiStore.showToast(`Move failed: ${getErrorMessage(caughtError)}`, 'error');
		}
		moveDialogStore.closeMoveDialog();
	}
</script>

{#if moveDialogStore.open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="presentation"
		onclick={() => moveDialogStore.closeMoveDialog()}
			onkeydown={(event: KeyboardEvent) => event.key === 'Escape' && moveDialogStore.closeMoveDialog()}
	>
		<div
			class="bg-base-100 rounded-lg shadow-xl p-6 w-full max-w-md"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(event: MouseEvent) => event.stopPropagation()}
			onkeydown={(event: KeyboardEvent) => event.stopPropagation()}
		>
			<h3 class="text-lg font-bold mb-2">Move "{moveDialogStore.nodeToMove?.name}"</h3>
			<p class="text-sm opacity-60 mb-4">Select a target folder:</p>

			<select
				value={moveDialogStore.selectedTarget}
				onchange={(event) => moveDialogStore.setSelectedTarget(event.currentTarget.value)}
				class="select select-bordered w-full mb-4 max-h-60"
			>
				<option value="">-- Select folder --</option>
				{#each moveDialogStore.folders as folder}
					<option value={folder.id}>{folder.name}</option>
				{/each}
			</select>

			<div class="flex justify-end gap-2">
				<button class="btn btn-sm btn-ghost" onclick={() => moveDialogStore.closeMoveDialog()}>Cancel</button>
				<button class="btn btn-sm btn-primary" onclick={move} disabled={!moveDialogStore.selectedTarget}>
					Move
				</button>
			</div>
		</div>
	</div>
{/if}
