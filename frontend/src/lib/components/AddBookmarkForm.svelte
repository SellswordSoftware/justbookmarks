<script lang="ts">
	import { AddBookmark, FetchPageTitle } from '../api';
	import { getErrorMessage } from '../errors';
	import { uiStore } from '../stores/uiStore.svelte.ts';
	import { treeStore } from '../stores/treeStore.svelte.ts';

	interface Props {
		parentFolderId: string;
		onAdded?: () => void;
	}

	let { parentFolderId, onAdded }: Props = $props();

	let url = $state('');
	let title = $state('');
	let fetchingTitle = $state(false);
	let error = $state('');
	let lastAutoTitle = $state('');
	let fetchSequence = 0;

	function canFetchTitle(value: string): boolean {
		try {
			const parsed = new URL(value.trim());
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	$effect(() => {
		const currentURL = url.trim();

		if (!canFetchTitle(currentURL)) {
			fetchingTitle = false;
			return;
		}

		const requestId = ++fetchSequence;
		const timer = setTimeout(async () => {
			fetchingTitle = true;
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

	async function submit() {
		if (!url.trim()) {
			error = 'URL is required';
			return;
		}
		try {
			await AddBookmark(parentFolderId, { title: title.trim(), url: url.trim() });
			uiStore.showToast('Bookmark added', 'success');
			url = '';
			title = '';
			lastAutoTitle = '';
			error = '';
			await treeStore.refresh();
			if (onAdded) onAdded();
		} catch (caughtError: unknown) {
			error = getErrorMessage(caughtError, 'Failed to add bookmark');
			uiStore.showToast(error, 'error');
		}
	}

</script>

<div class="bg-base-200 rounded-lg p-3">
	<div class="flex items-center gap-2 mb-2">
		<span class="text-sm font-semibold">New Bookmark</span>
		<button class="btn btn-ghost btn-xs" aria-label="Close add bookmark form" title="Close add bookmark form" onclick={() => onAdded?.()}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
	<div class="flex items-center gap-2 mb-2">
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
	</div>
	<input
		type="text"
		bind:value={title}
		class="input input-bordered input-sm w-full mb-2"
		placeholder="Title (auto-filled)"
	/>
	{#if error}
		<p class="text-error text-xs mb-2">{error}</p>
	{/if}
	<button class="btn btn-sm btn-primary w-full" onclick={submit}>Add Bookmark</button>
</div>
