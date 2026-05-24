<script lang="ts">
	import { trapFocusInContainer } from '../focus';

	interface ShortcutGroup {
		title: string;
		items: { keys: string; action: string }[];
	}

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let dialogRef = $state<HTMLDivElement | undefined>(undefined);
	let closeButtonRef = $state<HTMLButtonElement | undefined>(undefined);

	const groups: ShortcutGroup[] = [
		{
			title: 'Global',
			items: [
				{ keys: 'Ctrl/Cmd+O', action: 'Open file' },
				{ keys: 'Ctrl/Cmd+N', action: 'Create file' },
				{ keys: 'Ctrl/Cmd+Shift+I', action: 'Import / merge' },
				{ keys: 'Ctrl/Cmd+F or /', action: 'Focus search' },
				{ keys: 'F6', action: 'Cycle focus zones' },
				{ keys: 'Ctrl/Cmd+Z', action: 'Undo' },
				{ keys: 'Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z', action: 'Redo' },
				{ keys: '? or F1', action: 'Show keyboard help' },
			],
		},
		{
			title: 'Tree',
			items: [
				{ keys: 'Arrow keys', action: 'Navigate tree or search results' },
				{ keys: 'Home / End', action: 'Jump first or last item' },
				{ keys: 'PageUp / PageDown', action: 'Jump by larger step' },
				{ keys: 'Enter', action: 'Open detail panel for selection' },
				{ keys: 'Space', action: 'Toggle folder expand/collapse' },
			],
		},
		{
			title: 'Selection',
			items: [
				{ keys: 'Shift+Up / Shift+Down', action: 'Extend selection range' },
				{ keys: 'Ctrl/Cmd+Space', action: 'Toggle current item in selection' },
				{ keys: 'Ctrl/Cmd+A', action: 'Select all siblings' },
				{ keys: 'Ctrl/Cmd+Shift+A', action: 'Collapse to primary selection' },
			],
		},
		{
			title: 'Actions',
			items: [
				{ keys: 'A', action: 'Add bookmark' },
				{ keys: 'Shift+A', action: 'Add folder' },
				{ keys: 'E', action: 'Edit item' },
				{ keys: 'F2', action: 'Rename item' },
				{ keys: 'O', action: 'Open bookmark' },
				{ keys: 'M', action: 'Move selection' },
				{ keys: 'Delete / Backspace', action: 'Delete selection' },
				{ keys: 'Ctrl/Cmd+Shift+F', action: 'Fetch favicon(s)' },
				{ keys: 'Ctrl/Cmd+Shift+T', action: 'Refresh title(s)' },
			],
		},
		{
			title: 'Other Features',
			items: [
				{ keys: 'Ctrl/Cmd+Click', action: 'Add or remove an item from multi-selection' },
				{ keys: 'Shift+Click', action: 'Select a range within the current sibling group' },
				{ keys: 'Drag and Drop', action: 'Reorder items or move them into folders' },
				{ keys: 'Search + Enter', action: 'Jump from search results into the detail panel' },
				{ keys: 'Search + Ctrl/Cmd+Enter', action: 'Open the selected search result directly' },
			],
		},
	];

	$effect(() => {
		if (open) {
			queueMicrotask(() => closeButtonRef?.focus());
		}
	});

	function handleDialogKeydown(event: KeyboardEvent): void {
		if (trapFocusInContainer(event, dialogRef)) {
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose()}>
		<div
			bind:this={dialogRef}
			class="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-base-100 shadow-2xl"
			data-focus-zone="dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="keyboard-shortcuts-title"
			tabindex="-1"
			onclick={(event: MouseEvent) => event.stopPropagation()}
			onkeydown={handleDialogKeydown}
		>
			<div class="flex items-start justify-between gap-4 border-b border-base-300 px-6 py-4">
				<div>
					<h2 id="keyboard-shortcuts-title" class="text-xl font-semibold">Keyboard Shortcuts</h2>
					<p class="mt-1 text-sm opacity-65">Core commands for mouse-free bookmark management.</p>
				</div>
				<button bind:this={closeButtonRef} class="btn btn-ghost btn-sm" type="button" data-keyboard-action="shortcuts-close" onclick={onClose}>
					Close
				</button>
			</div>

			<div class="grid flex-1 gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
				{#each groups as group}
					<section class="rounded-box border border-base-300">
						<div class="border-b border-base-300 px-4 py-3">
							<h3 class="font-medium">{group.title}</h3>
						</div>
						<div class="divide-y divide-base-300">
							{#each group.items as item}
								<div class="flex items-start justify-between gap-4 px-4 py-3">
									<kbd class="rounded border border-base-300 bg-base-200 px-2 py-1 text-xs font-medium">
										{item.keys}
									</kbd>
									<span class="text-right text-sm opacity-75">{item.action}</span>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
	</div>
{/if}
