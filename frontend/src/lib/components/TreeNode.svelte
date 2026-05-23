<script>
	import { treeStore } from '../stores/treeStore.svelte.js';
	import TreeNode from './TreeNode.svelte';

	// Props
	let { node, depth = 0 } = $props();
	const nodeId = $derived(node?.id || node?.folder?.id || node?.bookmark?.id || '');
	const childNodes = $derived(node?.type === 0 ? (node?.folder?.children ?? []).filter(Boolean) : []);

	// Drag state
	let isDragOver = $state(false);
	let isDragging = $state(false);
	let dropPosition = $state(''); // 'before', 'after', 'inside'

	function handleDragStart(e) {
		if (!nodeId) return;
		isDragging = true;
		e.dataTransfer.setData('text/plain', nodeId);
		e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragEnd() {
		isDragging = false;
	}

	function handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		if (node.type === 0) {
			isDragOver = true;
			const rect = e.currentTarget.getBoundingClientRect();
			const relY = (e.clientY - rect.top) / rect.height;
			if (relY < 0.33) {
				dropPosition = 'before';
			} else if (relY > 0.66) {
				dropPosition = 'after';
			} else {
				dropPosition = 'inside';
			}
		}
	}

	function handleDragLeave() {
		isDragOver = false;
		dropPosition = '';
	}

	function handleDrop(e) {
		e.preventDefault();
		isDragOver = false;
		dropPosition = '';
		if (node?.type !== 0 || !nodeId) return;

		const draggedId = e.dataTransfer.getData('text/plain');
		if (draggedId === nodeId) return;

		// Calculate drop index
		const rect = e.currentTarget.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		const index = e.clientY < midY ? 0 : -1;

		// Call backend to move
		import('../api.js').then((api) => {
			api.MoveNode(draggedId, nodeId, index).catch((err) => {
				import('../stores/uiStore.svelte.js').then((ui) => {
					ui.uiStore.showToast(err.message || 'Move failed', 'error');
				});
			});
			treeStore.refresh();
		});
	}
</script>

{#if !node || !nodeId}
	<!-- Skip malformed nodes instead of throwing during render -->
{:else if node.type === 0}
	<!-- Folder node -->
	<div>
		<!-- Insertion indicator above -->
		{#if isDragOver && dropPosition === 'before'}
			<div class="h-0.5 bg-secondary rounded-full mx-2"></div>
		{/if}
		<div
			class={`tree-row flex items-center gap-1 py-1 px-2 cursor-pointer select-none
				${treeStore.selectedNodeId === nodeId ? 'bg-primary/20 text-primary' : 'hover:bg-base-200'}
				${isDragOver && dropPosition === 'inside' ? 'bg-secondary/20 border-2 border-dashed border-secondary' : ''}
				${isDragging ? 'opacity-40' : ''}
			`}
			style="padding-left: calc(${depth} * 16px + 8px)"
			onclick={() => treeStore.selectNode(nodeId)}
			draggable="true"
			ondragstart={handleDragStart}
			ondragend={handleDragEnd}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			<!-- Expand/collapse chevron -->
			<button
				class="btn btn-ghost btn-xs p-0 h-4 min-h-0 inline-flex items-center justify-center"
				onclick={(e) => {
					e.stopPropagation();
					treeStore.toggleExpand(nodeId);
				}}
			>
				{#if treeStore.isExpanded(nodeId)}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
					</svg>
				{/if}
			</button>
			<!-- Folder icon -->
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
				{#if treeStore.isExpanded(nodeId)}
					<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
				{:else}
					<path d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1a2 2 0 01-2 2H2a1 1 0 01-1-1v-5.268A8.001 8.001 0 012 6z" />
				{/if}
			</svg>
			<span class="truncate text-sm">{node.folder.name}</span>
			<span class="text-xs opacity-40 ml-1">({childNodes.length})</span>
		</div>
		<!-- Insertion indicator below -->
		{#if isDragOver && dropPosition === 'after'}
			<div class="h-0.5 bg-secondary rounded-full mx-2"></div>
		{/if}
		<!-- Children -->
		{#if treeStore.isExpanded(nodeId)}
			{#each childNodes as child (child.id)}
				<TreeNode node={child} depth={depth + 1} />
			{/each}
		{/if}
	</div>
{:else}
	<!-- Bookmark node -->
	<div
		class={`tree-row flex items-center gap-2 py-1 px-2 cursor-pointer select-none
			${treeStore.selectedNodeId === nodeId ? 'bg-primary/20 text-primary' : 'hover:bg-base-200'}
			${isDragging ? 'opacity-40' : ''}
		`}
		style="padding-left: calc(${depth} * 16px + 24px)"
		onclick={() => treeStore.selectNode(nodeId)}
		draggable="true"
		ondragstart={handleDragStart}
		ondragend={handleDragEnd}
	>
		<!-- Bookmark icon -->
		{#if node.bookmark.icon}
			<img src={node.bookmark.icon} alt="" class="h-4 w-4 flex-shrink-0" />
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
				<path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
			</svg>
		{/if}
		<span class="truncate text-sm">{node.bookmark.title || node.bookmark.url}</span>
	</div>
{/if}
