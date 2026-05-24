<script lang="ts">
	import { trapFocusInContainer } from '../focus';
	import type { MergePreview } from '../types';

	interface Props {
		open: boolean;
		importPath: string;
		preview: MergePreview | null;
		previewLoading?: boolean;
		applyLoading?: boolean;
		error?: string;
		onCancel: () => void;
		onApply: () => void | Promise<void>;
		onPickAnother: () => void | Promise<void>;
	}

	let {
		open,
		importPath,
		preview,
		previewLoading = false,
		applyLoading = false,
		error = '',
		onCancel,
		onApply,
		onPickAnother,
	}: Props = $props();

	let chooseFileButtonRef = $state<HTMLButtonElement | undefined>(undefined);
	let cancelButtonRef = $state<HTMLButtonElement | undefined>(undefined);
	let dialogRef = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		if (open) {
			queueMicrotask(() => {
				chooseFileButtonRef?.focus() ?? cancelButtonRef?.focus();
			});
		}
	});

	const sections = $derived(
		preview
			? [
					{
						title: 'Folders to add',
						count: preview.foldersToAdd.length,
						rows: preview.foldersToAdd.map((item) => ({
							title: item.path,
							subtitle: item.name,
						})),
					},
					{
						title: 'Bookmarks to add',
						count: preview.bookmarksToAdd.length,
						rows: preview.bookmarksToAdd.map((item) => ({
							title: item.title || item.url,
							subtitle: [item.folderPath || 'Root', item.url].join('  •  '),
						})),
					},
					{
						title: 'Duplicates ignored',
						count: preview.duplicateBookmarks.length,
						rows: preview.duplicateBookmarks.map((item) => ({
							title: item.title || item.url,
							subtitle: [item.folderPath || 'Root', item.url].join('  •  '),
						})),
					},
					{
						title: 'Potential updates',
						count: preview.potentialUpdates.length,
						rows: preview.potentialUpdates.map((item) => ({
							title: `${item.existingTitle || item.url} -> ${item.incomingTitle || item.url}`,
							subtitle: [item.folderPath || 'Root', item.url].join('  •  '),
						})),
					},
				]
			: [],
	);

	function handleDialogKeydown(event: KeyboardEvent): void {
		if (trapFocusInContainer(event, dialogRef)) {
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
			return;
		}

		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && preview && !previewLoading && !applyLoading) {
			event.preventDefault();
			void onApply();
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="presentation" onclick={(event) => event.target === event.currentTarget && onCancel()}>
		<div bind:this={dialogRef} class="card w-full max-w-4xl bg-base-100 shadow-2xl" data-focus-zone="dialog" role="dialog" aria-modal="true" aria-labelledby="import-merge-title" tabindex="-1" onkeydown={handleDialogKeydown}>
			<div class="card-body gap-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h2 id="import-merge-title" class="text-xl font-semibold">Import and Merge</h2>
						<p class="mt-1 text-sm opacity-70">Review additive changes before updating the current bookmark file.</p>
					</div>
					<button class="btn btn-ghost btn-sm btn-square" type="button" aria-label="Close import merge dialog" onclick={onCancel}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="flex flex-col gap-3 rounded-box border border-base-300 bg-base-200/40 p-3 md:flex-row md:items-center md:justify-between">
					<div class="min-w-0">
						<div class="text-xs uppercase tracking-wide opacity-60">Import file</div>
						<div class="truncate text-sm">{importPath || 'No file selected'}</div>
					</div>
					<button bind:this={chooseFileButtonRef} class="btn btn-sm btn-outline" data-keyboard-action="import-choose-file" type="button" onclick={onPickAnother} disabled={previewLoading || applyLoading}>
						Choose File
					</button>
				</div>

				{#if error}
					<div class="alert alert-error">
						<span>{error}</span>
					</div>
				{/if}

				{#if previewLoading}
					<div class="flex items-center gap-3 rounded-box border border-base-300 p-6">
						<span class="loading loading-spinner loading-md"></span>
						<span class="text-sm opacity-70">Computing merge preview...</span>
					</div>
				{:else if preview}
					<div class="grid gap-3 md:grid-cols-4">
						<div class="stat rounded-box border border-base-300 bg-base-100">
							<div class="stat-title">Folders</div>
							<div class="stat-value text-2xl">{preview.foldersToAdd.length}</div>
							<div class="stat-desc">to add</div>
						</div>
						<div class="stat rounded-box border border-base-300 bg-base-100">
							<div class="stat-title">Bookmarks</div>
							<div class="stat-value text-2xl">{preview.bookmarksToAdd.length}</div>
							<div class="stat-desc">to add</div>
						</div>
						<div class="stat rounded-box border border-base-300 bg-base-100">
							<div class="stat-title">Duplicates</div>
							<div class="stat-value text-2xl">{preview.duplicateBookmarks.length}</div>
							<div class="stat-desc">ignored</div>
						</div>
						<div class="stat rounded-box border border-base-300 bg-base-100">
							<div class="stat-title">Potential updates</div>
							<div class="stat-value text-2xl">{preview.potentialUpdates.length}</div>
							<div class="stat-desc">not applied</div>
						</div>
					</div>

					<div class="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
						{#each sections as section}
							<section class="rounded-box border border-base-300">
								<div class="flex items-center justify-between border-b border-base-300 px-4 py-3">
									<h3 class="font-medium">{section.title}</h3>
									<span class="badge badge-ghost">{section.count}</span>
								</div>
								{#if section.rows.length === 0}
									<p class="px-4 py-3 text-sm opacity-60">None</p>
								{:else}
									<div class="divide-y divide-base-300">
										{#each section.rows as row}
											<div class="px-4 py-3">
												<div class="text-sm font-medium break-all">{row.title}</div>
												<div class="text-xs opacity-60 break-all">{row.subtitle}</div>
											</div>
										{/each}
									</div>
								{/if}
							</section>
						{/each}
					</div>
				{/if}

				<div class="flex justify-end gap-2">
					<button bind:this={cancelButtonRef} class="btn btn-ghost" data-keyboard-action="import-cancel" type="button" onclick={onCancel} disabled={applyLoading}>
						Cancel
					</button>
					<button
						class="btn btn-primary"
						data-keyboard-action="import-apply"
						type="button"
						onclick={onApply}
						disabled={!preview || previewLoading || applyLoading}
					>
						{#if applyLoading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Apply Merge
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
