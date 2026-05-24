<script lang="ts">
	import { MoveNode, MoveNodes } from '../api';
	import { getErrorMessage } from '../errors';
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { moveDialogStore } from '../stores/moveDialogStore.svelte.ts';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import type { MoveTarget } from '../types';

	function isSelected(folder: MoveTarget): boolean {
		return moveDialogStore.selectedTarget === folder.id;
	}

	function selectTarget(folderId: string): void {
		moveDialogStore.setSelectedTarget(folderId);
	}

	async function move() {
		const request = moveDialogStore.request;
		if (!moveDialogStore.selectedTarget || !request) return;
		try {
			if (request.nodeIds.length === 1) {
				await MoveNode(request.nodeIds[0], moveDialogStore.selectedTarget, -1);
			} else {
				await MoveNodes(request.nodeIds, moveDialogStore.selectedTarget);
			}
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
			<h3 class="text-lg font-bold mb-2">Move "{moveDialogStore.request?.label}"</h3>
			<p class="text-sm opacity-60 mb-4">Select a target folder:</p>

			<div class="mb-4 overflow-hidden rounded-box border border-base-300 bg-base-100">
				<div class="border-b border-base-300 bg-base-200/60 px-3 py-2 text-xs uppercase tracking-[0.12em] opacity-50">
					Folder Tree
				</div>
				<div class="max-h-72 overflow-y-auto p-2" role="listbox" aria-label="Target folder">
					{#if moveDialogStore.folders.length === 0}
						<div class="px-3 py-6 text-center text-sm opacity-45">No eligible folders</div>
					{:else}
						{#each moveDialogStore.folders as folder (folder.id)}
							<button
								type="button"
								role="option"
								aria-selected={isSelected(folder)}
								class={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
									isSelected(folder)
										? 'bg-primary text-primary-content'
										: 'hover:bg-base-200'
								}`}
								style={`padding-left: ${folder.depth * 18 + 12}px;`}
								onclick={() => selectTarget(folder.id)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="mt-0.5 h-4 w-4 shrink-0"
									viewBox="0 0 640 640"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M128 512L512 512C547.3 512 576 483.3 576 448L576 208C576 172.7 547.3 144 512 144L362.7 144C355.8 144 349 141.8 343.5 137.6L305.1 108.8C294 100.5 280.5 96 266.7 96L128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512z" />
								</svg>
								<span class="min-w-0">
									<span class="block truncate text-sm font-medium">{folder.name}</span>
									<span class={`block truncate text-xs ${isSelected(folder) ? 'text-primary-content/75' : 'opacity-50'}`}>
										{folder.pathLabel}
									</span>
								</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<button class="btn btn-sm btn-ghost" onclick={() => moveDialogStore.closeMoveDialog()}>Cancel</button>
				<button class="btn btn-sm btn-primary" onclick={move} disabled={!moveDialogStore.selectedTarget}>
					Move
				</button>
			</div>
		</div>
	</div>
{/if}
