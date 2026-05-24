<script lang="ts">
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { searchStore } from '../stores/searchStore.svelte.ts';
	import TreeNode from './TreeNode.svelte';
	import type { BookmarkIndexEntry, TreeNode as BookmarkTreeNode, VisibleTreeNodeEntry } from '../types';
	import { isFolderNode } from '../types';

	const isSearching = $derived(searchStore.query.trim().length > 0);
	const searchResults = $derived(isSearching ? searchStore.getResults() : []);
	const rootNodes = $derived(treeStore.tree);

	function getVisibleNodes(
		nodes: BookmarkTreeNode[],
		depth = 0,
		parentId = '',
	): VisibleTreeNodeEntry[] {
		const result: VisibleTreeNodeEntry[] = [];
		for (const node of nodes) {
			result.push({ id: node.id, node, depth, parentId });
			if (isFolderNode(node) && treeStore.isExpanded(node.id)) {
				result.push(...getVisibleNodes(node.folder.children ?? [], depth + 1, node.id));
			}
		}
		return result;
	}

	function handleTreeKeydown(event: KeyboardEvent) {
		if (isSearching) return;

		const visibleNodes = getVisibleNodes(rootNodes);
		if (visibleNodes.length === 0) return;

		const currentIndex = visibleNodes.findIndex((entry: VisibleTreeNodeEntry) => entry.id === treeStore.selectedNodeId);
		const selectedEntry = currentIndex >= 0 ? visibleNodes[currentIndex] : null;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			const nextEntry = currentIndex >= 0 ? visibleNodes[currentIndex + 1] : visibleNodes[0];
			if (nextEntry) treeStore.selectNode(nextEntry.id);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prevEntry = currentIndex > 0 ? visibleNodes[currentIndex - 1] : visibleNodes[0];
			if (prevEntry) treeStore.selectNode(prevEntry.id);
			return;
		}

		if (!selectedEntry) return;

		if (event.key === 'ArrowRight' && isFolderNode(selectedEntry.node)) {
			event.preventDefault();
			if (!treeStore.isExpanded(selectedEntry.id)) {
				treeStore.toggleExpand(selectedEntry.id);
			} else {
				const firstChild = selectedEntry.node.folder.children?.[0];
				if (firstChild) treeStore.selectNode(firstChild.id);
			}
			return;
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			if (isFolderNode(selectedEntry.node) && treeStore.isExpanded(selectedEntry.id)) {
				treeStore.toggleExpand(selectedEntry.id);
			} else if (selectedEntry.parentId) {
				treeStore.selectNode(selectedEntry.parentId);
			}
		}
	}
</script>

<div class="h-full overflow-y-auto bg-base-100" role="tree" tabindex="0" onkeydown={handleTreeKeydown}>
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
					role="button"
					tabindex="0"
					onclick={() => {
						treeStore.selectNode(result.nodeId);
					}}
					onkeydown={(event: KeyboardEvent) => (event.key === 'Enter' || event.key === ' ') && treeStore.selectNode(result.nodeId)}
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
