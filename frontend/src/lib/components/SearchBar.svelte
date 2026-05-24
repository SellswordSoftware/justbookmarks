<script lang="ts">
	import type { Snippet } from 'svelte';
	import { searchStore } from '../stores/searchStore.svelte.ts';

	interface Props {
		actions?: Snippet;
		onInputReady?: (input: HTMLInputElement | undefined) => void;
		onInputKeydown?: (event: KeyboardEvent) => void;
	}

	let { actions, onInputReady, onInputKeydown }: Props = $props();

	let inputRef: HTMLInputElement | undefined;
	let hasFocused = false;

	$effect(() => {
		onInputReady?.(inputRef);
		if (!hasFocused && inputRef) {
			inputRef.focus();
			hasFocused = true;
		}
	});
</script>

<div class="flex items-center justify-between gap-4 px-4 py-2 bg-base-100 border-b border-base-300">
	<div class="flex min-w-0 flex-1 items-center gap-2">
		<span class="text-xs opacity-50">Search</span>
		<input
			bind:this={inputRef}
			type="text"
			placeholder="Search bookmarks..."
			class="input input-bordered input-sm flex-1 max-w-xl"
			data-focus-zone="search"
			data-keyboard-action="search-input"
			oninput={(event) => searchStore.setQuery(event.currentTarget.value)}
			onkeydown={onInputKeydown}
		/>
		{#if searchStore.query}
			<button class="btn btn-ghost btn-sm" aria-label="Clear search" title="Clear search" onclick={() => searchStore.setQuery('')}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		{#if actions}
			{@render actions()}
		{/if}
	</div>
</div>
