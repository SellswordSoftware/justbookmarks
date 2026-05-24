<script lang="ts">
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { searchStore } from '../stores/searchStore.svelte.ts';
	import AddBookmarkForm from './AddBookmarkForm.svelte';
	import AddFolderForm from './AddFolderForm.svelte';
	import TreeNode from './TreeNode.svelte';
	import type { VisibleTreeNodeEntry } from '../types';
	import { isFolderNode } from '../types';

	const isSearching = $derived(searchStore.query.trim().length > 0);
	const searchResults = $derived(isSearching ? searchStore.getResults() : []);
	const rootNodes = $derived(treeStore.tree);
	const rootFolderCount = $derived(rootNodes.filter(isFolderNode).length);
	const visibleNodes = $derived(treeStore.getVisibleNodeEntries(rootNodes));
	let showAddRootFolder = $state(false);
	let showAddRootBookmark = $state(false);

	function handleTreeKeydown(event: KeyboardEvent) {
		if (isSearching) return;

		if (visibleNodes.length === 0) return;

		const currentIndex = visibleNodes.findIndex((entry: VisibleTreeNodeEntry) => entry.id === treeStore.selectedNodeId);
		const selectedEntry = currentIndex >= 0 ? visibleNodes[currentIndex] : null;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			const nextEntry = currentIndex >= 0 ? visibleNodes[currentIndex + 1] : visibleNodes[0];
			if (nextEntry) treeStore.selectSingle(nextEntry.id);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prevEntry = currentIndex > 0 ? visibleNodes[currentIndex - 1] : visibleNodes[0];
			if (prevEntry) treeStore.selectSingle(prevEntry.id);
			return;
		}

		if (!selectedEntry) return;

		if (event.key === 'ArrowRight' && isFolderNode(selectedEntry.node)) {
			event.preventDefault();
			if (!treeStore.isExpanded(selectedEntry.id)) {
				treeStore.toggleExpand(selectedEntry.id);
			} else {
				const firstChild = selectedEntry.node.folder.children?.[0];
				if (firstChild) treeStore.selectSingle(firstChild.id);
			}
			return;
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			if (isFolderNode(selectedEntry.node) && treeStore.isExpanded(selectedEntry.id)) {
				treeStore.toggleExpand(selectedEntry.id);
			} else if (selectedEntry.parentId) {
				treeStore.selectSingle(selectedEntry.parentId);
			}
		}
	}
</script>

<div class="h-full flex flex-col bg-base-100">
	<div class="flex items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-3 py-2">
		<div class="min-w-0">
			<p class="text-xs font-medium uppercase tracking-[0.12em] opacity-50">Library</p>
			<p class="text-xs opacity-40">{rootNodes.length} root item{rootNodes.length !== 1 ? 's' : ''}, {rootFolderCount} folder{rootFolderCount !== 1 ? 's' : ''}</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				class={`btn btn-sm btn-square ${showAddRootBookmark ? 'btn-primary' : 'btn-ghost'}`}
				type="button"
				aria-label="New bookmark"
				title="New bookmark"
				onclick={() => {
					showAddRootBookmark = !showAddRootBookmark;
					if (showAddRootBookmark) {
						showAddRootFolder = false;
					}
				}}
			>
				<span class="relative block h-5 w-5" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
					</svg>
					<span class="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-primary-content ring-2 ring-base-100">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-1.75 w-1.75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 5v14m7-7H5" />
						</svg>
					</span>
				</span>
			</button>
			<button
				class={`btn btn-sm btn-square ${showAddRootFolder ? 'btn-secondary' : 'btn-ghost'}`}
				type="button"
				aria-label="New folder"
				title="New folder"
				onclick={() => {
					showAddRootFolder = !showAddRootFolder;
					if (showAddRootFolder) {
						showAddRootBookmark = false;
					}
				}}
			>
				<span class="relative block h-5 w-5" aria-hidden="true">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 640 640" fill="currentColor">
						<path d="M128 512L512 512C547.3 512 576 483.3 576 448L576 208C576 172.7 547.3 144 512 144L362.7 144C355.8 144 349 141.8 343.5 137.6L305.1 108.8C294 100.5 280.5 96 266.7 96L128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512z" />
					</svg>
					<span class="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-secondary text-secondary-content ring-2 ring-base-100">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-1.75 w-1.75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 5v14m7-7H5" />
						</svg>
					</span>
				</span>
			</button>
		</div>
	</div>

	<div class="border-b border-base-300 bg-base-200/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] opacity-45">
		Ctrl/Cmd-click to add. Shift-click for range.
	</div>

	{#if showAddRootBookmark}
		<div class="border-b border-base-300 bg-base-200/40 p-3">
			<AddBookmarkForm parentFolderId="" onAdded={() => showAddRootBookmark = false} />
		</div>
	{/if}

	{#if showAddRootFolder}
		<div class="border-b border-base-300 bg-base-200/40 p-3">
			<AddFolderForm parentFolderId="" onAdded={() => showAddRootFolder = false} />
		</div>
	{/if}

<div class="flex-1 overflow-y-auto bg-base-100" role="tree" tabindex="0" onkeydown={handleTreeKeydown}>
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
						treeStore.selectSingle(result.nodeId);
					}}
					onkeydown={(event: KeyboardEvent) => (event.key === 'Enter' || event.key === ' ') && treeStore.selectSingle(result.nodeId)}
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
				<div class="text-center opacity-40 py-8 text-sm">No bookmarks or folders yet</div>
			{/if}
		</div>
	{/if}
</div>
</div>
