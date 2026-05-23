<script>
	import { searchStore } from '../stores/searchStore.svelte.js';

	let inputRef;

	$effect(() => {
		inputRef?.focus();
	});
</script>

<div class="flex items-center gap-2 px-4 py-2 bg-base-100 border-b border-base-300">
	<span class="text-xs opacity-50">Search</span>
	<input
		bind:this={inputRef}
		type="text"
		placeholder="Search bookmarks..."
		class="input input-bordered input-sm flex-1 max-w-md"
		oninput={(e) => searchStore.setQuery(e.currentTarget.value)}
	/>
	{#if searchStore.query}
		<button class="btn btn-ghost btn-sm" onclick={() => searchStore.setQuery('')}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>
