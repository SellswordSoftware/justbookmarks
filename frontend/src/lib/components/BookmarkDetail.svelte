<script lang="ts">
	import { DeleteNode, FetchFavicon, FetchPageTitle, OpenURL, UpdateBookmark } from '../api';
	import { getErrorMessage } from '../errors';
	import { moveDialogStore } from '../stores/moveDialogStore.svelte.ts';
	import { treeStore } from '../stores/treeStore.svelte.ts';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import type { BookmarkNode } from '../types';

	interface Props {
		bookmark: BookmarkNode;
	}

	let { bookmark }: Props = $props();
	let editing = $state(false);
	let title = $state('');
	let url = $state('');
	let icon = $state('');
	let meta = $state('');
	let fetchingTitle = $state(false);
	let fetchingFavicon = $state(false);
	let titleError = $state('');
	let faviconError = $state('');
	let lastAutoTitle = $state('');
	let lastAutoIcon = $state('');
	let fetchSequence = 0;
	const notesFieldId = $derived(`bookmark-notes-${bookmark?.id ?? 'current'}`);
	const displayIcon = $derived(editing ? (icon || bookmark.bookmark.icon) : bookmark.bookmark.icon);

	function hasRealDate(value: string): boolean {
		return Boolean(value) && !String(value).startsWith('0001-01-01');
	}

	function canFetchTitle(value: string): boolean {
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
			icon = bookmark.bookmark.icon;
			meta = bookmark.bookmark.meta || '';
			lastAutoTitle = bookmark.bookmark.title || '';
			lastAutoIcon = bookmark.bookmark.icon || '';
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
				const [titleResult, faviconResult] = await Promise.allSettled([
					FetchPageTitle(currentURL),
					FetchFavicon(currentURL),
				]);
				if (requestId !== fetchSequence) return;

				if (titleResult.status === 'fulfilled' && titleResult.value) {
					if (!title.trim() || title === lastAutoTitle) {
						title = titleResult.value;
						lastAutoTitle = titleResult.value;
					}
				}

				if (faviconResult.status === 'fulfilled' && faviconResult.value) {
					if (!icon || icon === lastAutoIcon) {
						icon = faviconResult.value;
						lastAutoIcon = faviconResult.value;
					}
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
		try {
			await UpdateBookmark(bookmark.id, {
				title: title.trim(),
				url: url.trim(),
				icon,
				meta: meta.trim(),
			});
			editing = false;
			await treeStore.refresh();
			uiStore.showToast('Bookmark updated', 'success');
		} catch (caughtError: unknown) {
			titleError = getErrorMessage(caughtError, 'Failed to update bookmark');
		}
	}

	async function fetchFavicon() {
		if (!url.trim()) return;
		fetchingFavicon = true;
		faviconError = '';
		try {
			const dataUri = await FetchFavicon(url.trim());
			if (dataUri) {
				icon = dataUri;
				lastAutoIcon = dataUri;
				await UpdateBookmark(bookmark.id, { icon: dataUri });
				await treeStore.refresh();
				uiStore.showToast('Favicon fetched', 'success');
			}
		} catch (caughtError: unknown) {
			faviconError = getErrorMessage(caughtError, 'Failed to fetch favicon');
			uiStore.showToast(faviconError, 'error');
		} finally {
			fetchingFavicon = false;
		}
	}

	async function openInBrowser() {
		try {
			await OpenURL(bookmark.bookmark.url);
		} catch (caughtError: unknown) {
			uiStore.showToast(`Failed to open URL: ${getErrorMessage(caughtError)}`, 'error');
		}
	}

	function showDeleteConfirm() {
		uiStore.showConfirm(
			'Delete Bookmark',
			`Delete "${bookmark.bookmark.title}"?`,
			'Delete',
			async () => {
				try {
					await DeleteNode(bookmark.id);
					treeStore.clearSelection();
					await treeStore.refresh();
					uiStore.showToast('Bookmark deleted', 'success');
				} catch (caughtError: unknown) {
					uiStore.showToast(getErrorMessage(caughtError, 'Failed to delete bookmark'), 'error');
				}
			}
		);
	}

	function showMoveDialog() {
		moveDialogStore.showMoveDialog(bookmark.id, bookmark.bookmark.title || bookmark.bookmark.url, 'bookmark');
	}
</script>

<div class="h-full flex flex-col">
	<div class="bg-base-200 p-4">
		<div class="flex items-start justify-between gap-4 mb-3">
			<div class="flex min-w-0 items-center gap-3">
				{#if displayIcon}
					<img src={displayIcon} alt="" class="h-6 w-6 rounded-sm ring-1 ring-base-content/10" />
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
						<h2 class="text-lg font-semibold truncate text-balance">{bookmark.bookmark.title || '(Untitled)'}</h2>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 flex-wrap justify-end gap-2">
				{#if editing}
					<button class="btn btn-sm btn-primary" onclick={saveBookmark}>Save</button>
					<button class="btn btn-sm btn-ghost" onclick={() => editing = false}>Cancel</button>
				{:else}
					<button class="btn btn-sm btn-ghost" onclick={() => editing = true}>Edit</button>
					<button class="btn btn-sm btn-ghost" onclick={showMoveDialog}>Move...</button>
					<button class="btn btn-sm btn-error btn-outline" onclick={showDeleteConfirm}>Delete</button>
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
					onclick={(event: MouseEvent) => {
						event.preventDefault();
						openInBrowser();
					}}
				>
					{bookmark.bookmark.url}
				</a>
			{/if}
		</div>

		{#if !editing}
			<div class="flex flex-wrap items-center gap-2 mb-2">
				<button class="btn btn-sm btn-outline btn-primary" onclick={openInBrowser}>Open</button>
				<button class="btn btn-sm btn-ghost" onclick={fetchFavicon} disabled={fetchingFavicon}>
					{#if fetchingFavicon}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						Fetch Favicon
					{/if}
				</button>
			</div>
		{/if}

		{#if titleError}
			<p class="text-error text-xs mt-1">{titleError}</p>
		{/if}

		<!-- Dates -->
		<div class="text-xs opacity-40 mt-2 space-y-0.5">
			{#if hasRealDate(bookmark.bookmark.addDate)}
				<p>Added: {new Date(bookmark.bookmark.addDate).toLocaleString()}</p>
			{/if}
			{#if hasRealDate(bookmark.bookmark.lastModified)}
				<p>Modified: {new Date(bookmark.bookmark.lastModified).toLocaleString()}</p>
			{/if}
		</div>
	</div>

	<!-- Notes -->
	<div class="p-4 border-t border-base-300">
		<label class="label-text text-xs opacity-50 mb-1 block" for={notesFieldId}>Notes</label>
		{#if editing}
			<textarea
				id={notesFieldId}
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
</div>
