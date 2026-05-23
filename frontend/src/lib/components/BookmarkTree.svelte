<script>
	import { treeStore } from '../stores/treeStore.svelte.js';
	import { searchStore } from '../stores/searchStore.svelte.js';
	import TreeNode from './TreeNode.svelte';

	// When search is active, show flat results instead of tree
	$: isSearching = searchStore.query.trim().length > 0;

	// Search result items
	$: searchResults = isSearching ? searchStore.getResults() : [];
	$: rootNodes = treeStore.tree.filter(Boolean);
</script>

<div class="h-full overflow-y-auto bg-base-100">
	{#if isSearching}
		<!-- Search results view -->
		<div class="p-2">
			<div class="text-xs opacity-50 mb-2 px-2">
				{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchStore.query}"
			</div>
			{#each searchResults as result (result.nodeId)}
				<div
					class={`flex items-center gap-2 py-1 px-2 cursor-pointer rounded
						${treeStore.selectedNodeId === result.nodeId ? 'bg-primary/20 text-primary' : 'hover:bg-base-200'}
					`}
					onclick={() => {
						treeStore.selectNode(result.nodeId);
						// Expand the folder containing this result
						const parts = result.folderPath.split(' / ');
						parts.forEach((part) => {
							const found = treeStore.getNode(result.nodeId);
							// We'd need to expand parent folders — simplified for now
						});
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
					</svg>
					<span class="truncate text-sm">{result.title || result.url}</span>
					<span class="text-xs opacity-40 ml-auto">{result.folderPath}</span>
				</div>
			{/each}
			{#if searchResults.length === 0}
				<div class="text-center opacity-40 py-8 text-sm">No results found</div>
			{/if}
		</div>
	{:else}
		<!-- Tree view -->
		<div class="py-1">
			{#each rootNodes as node (node.id)}
				<TreeNode node={node} depth={0} />
			{/each}
			{#if rootNodes.length === 0}
				<div class="text-center opacity-40 py-8 text-sm">No bookmarks loaded</div>
			{/if}
		</div>
	{/if}
</div>
