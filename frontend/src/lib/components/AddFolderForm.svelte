<script lang="ts">
	import { AddFolder } from '../api';
	import { getErrorMessage } from '../errors';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import { treeStore } from '../stores/treeStore.svelte.ts';

	interface Props {
		parentFolderId: string;
		onAdded?: () => void;
	}

	let { parentFolderId, onAdded }: Props = $props();

	let name = $state('');
	let error = $state('');
	let nameInputRef = $state<HTMLInputElement | undefined>(undefined);
	let hasAutofocused = $state(false);

	async function submit() {
		if (!name.trim()) {
			error = 'Name is required';
			return;
		}
		try {
			await AddFolder(parentFolderId, name.trim());
			uiStore.showToast('Folder added', 'success');
			name = '';
			error = '';
			await treeStore.refresh();
			if (onAdded) onAdded();
		} catch (caughtError: unknown) {
			error = getErrorMessage(caughtError, 'Failed to add folder');
			uiStore.showToast(error, 'error');
		}
	}

	function handleFormKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onAdded?.();
			return;
		}

		if (event.key === 'Enter' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
			event.preventDefault();
			void submit();
		}
	}

	$effect(() => {
		if (hasAutofocused || !nameInputRef) return;

		hasAutofocused = true;
		queueMicrotask(() => {
			nameInputRef?.focus();
			nameInputRef?.select();
		});
	});
</script>

<div class="bg-base-200 rounded-lg p-3">
	<div class="flex items-center gap-2 mb-2">
		<span class="text-sm font-semibold">New Folder</span>
		<button class="btn btn-ghost btn-xs" aria-label="Close add folder form" title="Close add folder form" onclick={() => onAdded?.()}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
	<input
		bind:this={nameInputRef}
		type="text"
		bind:value={name}
		data-keyboard-action="add-folder-name"
		class="input input-bordered input-sm w-full mb-2"
		placeholder="Folder name"
		onkeydown={handleFormKeydown}
	/>
	{#if error}
		<p class="text-error text-xs mb-2">{error}</p>
	{/if}
	<button class="btn btn-sm btn-secondary w-full" data-keyboard-action="add-folder-submit" onclick={submit}>Add Folder</button>
</div>
