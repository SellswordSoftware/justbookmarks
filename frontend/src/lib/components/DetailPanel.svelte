<script>
	import { treeStore } from '../stores/treeStore.svelte.js';
	import FolderDetail from './FolderDetail.svelte';
	import BookmarkDetail from './BookmarkDetail.svelte';
	import MoveDialog from './MoveDialog.svelte';

	$: selectedNode = treeStore.selectedNodeId ? treeStore.getNode(treeStore.selectedNodeId) : null;
</script>

<div class="h-full overflow-y-auto bg-base-100">
	{#if selectedNode}
		{#if selectedNode.type === 0}
			<FolderDetail folder={selectedNode} />
		{:else}
			<BookmarkDetail bookmark={selectedNode} />
		{/if}
	{:else}
		<div class="h-full flex items-center justify-center">
			<div class="text-center opacity-40">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
				</svg>
				<p class="text-sm">Select a bookmark or folder</p>
				<p class="text-xs mt-1">from the tree on the left</p>
			</div>
		</div>
	{/if}
</div>

<MoveDialog />
