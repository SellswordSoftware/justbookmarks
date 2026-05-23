<script>
	import { treeStore } from './lib/stores/treeStore.svelte.js';
	import { searchStore } from './lib/stores/searchStore.svelte.js';
	import { uiStore } from './lib/stores/uiStore.svelte.js';
	import { GetFilePath, OpenFilePicker } from './lib/api.js';
	import SearchBar from './lib/components/SearchBar.svelte';
	import BookmarkTree from './lib/components/BookmarkTree.svelte';
	import DetailPanel from './lib/components/DetailPanel.svelte';
	import ToastContainer from './lib/components/ToastContainer.svelte';
	import ConfirmModal from './lib/components/ConfirmModal.svelte';

	let hasTriedLoad = $state(false);

	async function initApp() {
		// On mount, check if a file was passed via CLI
		// Guard: window.go may not exist when running in plain browser (Vite dev)
		if (typeof window.go === 'undefined') {
			return;
		}
		const filePath = await GetFilePath();
		if (typeof filePath === 'string' && filePath.length > 0) {
			await treeStore.loadFile(filePath);
			hasTriedLoad = true;
		}
	}

	$effect(() => {
		initApp();
	});

	async function openFile() {
		const path = await OpenFilePicker();
		if (path) {
			await treeStore.loadFile(path);
			hasTriedLoad = true;
		}
	}
</script>

<div class="h-screen flex flex-col bg-base-200">
	<!-- Welcome screen (no file loaded) -->
	{#if !hasTriedLoad || treeStore.tree.length === 0}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center max-w-sm">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto mb-6 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
				</svg>
				<h2 class="text-2xl font-bold mb-2">justbookmarks</h2>
				<p class="text-base-content/60 mb-6">Manage your bookmarks outside the browser. Open a Netscape Bookmarks HTML file to get started.</p>
				<button class="btn btn-primary" onclick={openFile}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
					</svg>
					Open Bookmark File
				</button>
				{#if treeStore.loading}
					<div class="mt-4">
						<span class="loading loading-spinner loading-sm text-primary"></span>
						<p class="text-xs text-base-content/50 mt-1">Loading...</p>
					</div>
				{/if}
				{#if treeStore.error}
					<p class="text-error text-xs mt-2">{treeStore.error}</p>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Main app layout -->
		<!-- Top bar -->
		<div class="navbar bg-base-100 shadow-sm px-4">
			<div class="flex-1">
				<h1 class="text-lg font-bold text-primary">justbookmarks</h1>
			</div>
			<div class="flex-none flex items-center gap-3">
				{#if treeStore.loading}
					<span class="loading loading-spinner loading-sm"></span>
				{:else if treeStore.error}
					<span class="text-error text-xs">{treeStore.error}</span>
				{:else}
					<span class="text-xs opacity-50">{treeStore.tree.length} root folder{treeStore.tree.length !== 1 ? 's' : ''}</span>
				{/if}
				<button class="btn btn-sm btn-ghost" onclick={openFile} title="Open another file">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Search -->
		<SearchBar />

		<!-- Main content -->
		<div class="flex-1 flex overflow-hidden">
			<!-- Left pane: Tree -->
			<div class="w-1/2 min-w-[300px] border-r border-base-300 overflow-y-auto bg-base-100">
				<BookmarkTree />
			</div>

			<!-- Right pane: Detail -->
			<div class="flex-1 overflow-y-auto bg-base-100 p-4">
				<DetailPanel />
			</div>
		</div>
	{/if}

	<!-- Global UI overlays -->
	<ToastContainer />
	<ConfirmModal />
</div>
