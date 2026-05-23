<script>
	import { UpdateBookmark, FetchPageTitle, FetchFavicon, OpenURL } from '../api.js';
	import { treeStore } from '../stores/treeStore.svelte.js';
	import { uiStore } from '../stores/uiStore.svelte.js';

	let { bookmark } = $props();
	let editing = $state(false);
	let title = $state('');
	let url = $state('');
	let meta = $state('');
	let fetchingTitle = $state(false);
	let fetchingFavicon = $state(false);
	let titleError = $state('');
	let faviconError = $state('');
	let lastAutoTitle = $state('');
	let fetchSequence = 0;

	function canFetchTitle(value) {
		try {
			const parsed = new URL(value.trim());
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	$effect(() => {
		if (bookmark) {
			title = bookmark.bookmark.title;
			url = bookmark.bookmark.url;
			meta = bookmark.bookmark.meta || '';
			lastAutoTitle = bookmark.bookmark.title || '';
			editing = false;
			titleError = '';
			faviconError = '';
		}
	});

	$effect(() => {
		const currentURL = url.trim();

		if (!editing || !canFetchTitle(currentURL)) {
			fetchingTitle = false;
			return;
		}

		const requestId = ++fetchSequence;
		const timer = setTimeout(async () => {
			fetchingTitle = true;
			titleError = '';
			try {
				const fetched = await FetchPageTitle(currentURL);
				if (requestId !== fetchSequence || !fetched) return;

				if (!title.trim() || title === lastAutoTitle) {
					title = fetched;
					lastAutoTitle = fetched;
				}
			} catch {
				// Auto-fill is best effort only.
			} finally {
				if (requestId === fetchSequence) {
					fetchingTitle = false;
				}
			}
		}, 800);

		return () => {
			clearTimeout(timer);
			if (requestId === fetchSequence) {
				fetchingTitle = false;
			}
		};
	});

	async function saveBookmark() {
		if (!url.trim()) {
			titleError = 'URL is required';
			return;
		}
		const result = await UpdateBookmark(bookmark.id, {
			title: title.trim(),
			url: url.trim(),
			meta: meta.trim(),
		});
		if (result) {
			titleError = result;
			return;
		}
		editing = false;
		uiStore.showToast('Bookmark updated', 'success');
		treeStore.refresh();
	}

	async function fetchFavicon() {
		if (!url.trim()) return;
		fetchingFavicon = true;
		faviconError = '';
		try {
			const dataUri = await FetchFavicon(url.trim());
			if (dataUri) {
				await UpdateBookmark(bookmark.id, { icon: dataUri });
				treeStore.refresh();
				uiStore.showToast('Favicon fetched', 'success');
			}
		} catch (e) {
			faviconError = e.message || 'Failed to fetch favicon';
			uiStore.showToast(faviconError, 'error');
		} finally {
			fetchingFavicon = false;
		}
	}

	async function openInBrowser() {
		try {
			await OpenURL(bookmark.bookmark.url);
		} catch (e) {
			uiStore.showToast('Failed to open URL: ' + e.message, 'error');
		}
	}

	function showDeleteConfirm() {
		uiStore.showConfirm(
			'Delete Bookmark',
			`Delete "${bookmark.bookmark.title}"?`,
			'Delete',
			async () => {
				await import('../api.js').then((api) => api.DeleteNode(bookmark.id));
				treeStore.selectedNodeId = '';
				treeStore.refresh();
				uiStore.showToast('Bookmark deleted', 'success');
			}
		);
	}
</script>

<div class="h-full flex flex-col">
	<div class="bg-base-200 p-4">
		<div class="flex items-center gap-3 mb-3">
			{#if bookmark.bookmark.icon}
				<img src={bookmark.bookmark.icon} alt="" class="h-6 w-6" />
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" viewBox="0 0 20 20" fill="currentColor">
					<path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
				</svg>
			{/if}
			<div class="flex-1 min-w-0">
				{#if editing}
					<input
						type="text"
						bind:value={title}
						class="input input-bordered input-sm w-full"
						placeholder="Title"
					/>
				{:else}
					<h2 class="text-lg font-semibold truncate">{bookmark.bookmark.title || '(Untitled)'}</h2>
				{/if}
			</div>
		</div>

		<!-- URL -->
		<div class="flex items-center gap-2 mb-2">
			{#if editing}
				<div class="flex-1 relative">
					<input
						type="url"
						bind:value={url}
						class="input input-bordered input-sm w-full"
						placeholder="https://example.com"
					/>
					{#if fetchingTitle}
						<span class="loading loading-spinner loading-xs absolute right-2 top-1/2 -translate-y-1/2"></span>
					{/if}
				</div>
			{:else}
				<a
					href={bookmark.bookmark.url}
					target="_blank"
					class="text-sm text-primary break-all hover:underline"
					onclick={(e) => {
						e.preventDefault();
						openInBrowser();
					}}
				>
					{bookmark.bookmark.url}
				</a>
			{/if}
		</div>

		{#if titleError}
			<p class="text-error text-xs mt-1">{titleError}</p>
		{/if}

		<!-- Dates -->
		<div class="text-xs opacity-40 mt-2 space-y-0.5">
			{#if bookmark.bookmark.addDate}
				<p>Added: {new Date(bookmark.bookmark.addDate).toLocaleString()}</p>
			{/if}
			{#if bookmark.bookmark.lastModified}
				<p>Modified: {new Date(bookmark.bookmark.lastModified).toLocaleString()}</p>
			{/if}
		</div>
	</div>

	<!-- Notes -->
	<div class="p-4 border-t border-base-300">
		<label class="label-text text-xs opacity-50 mb-1 block">Notes</label>
		{#if editing}
			<textarea
				bind:value={meta}
				class="textarea textarea-bordered w-full h-20"
				placeholder="Add notes..."
			></textarea>
		{:else if meta}
			<p class="text-sm whitespace-pre-wrap">{meta}</p>
		{:else}
			<p class="text-sm opacity-30">No notes</p>
		{/if}
	</div>

	<!-- Actions -->
	<div class="mt-auto p-4 border-t border-base-300 flex flex-wrap gap-2">
		{#if editing}
			<button class="btn btn-sm btn-primary" onclick={saveBookmark}>Save</button>
			<button class="btn btn-sm btn-ghost" onclick={() => editing = false}>Cancel</button>
		{:else}
			<button class="btn btn-sm btn-primary" onclick={() => editing = true}>Edit</button>
			<button class="btn btn-sm btn-ghost" onclick={openInBrowser}>Open</button>
			<button class="btn btn-sm btn-ghost" onclick={fetchFavicon} disabled={fetchingFavicon}>
				{#if fetchingFavicon}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					Favicon
				{/if}
			</button>
			<button class="btn btn-sm btn-error btn-outline ml-auto" onclick={showDeleteConfirm}>Delete</button>
		{/if}
	</div>
</div>
