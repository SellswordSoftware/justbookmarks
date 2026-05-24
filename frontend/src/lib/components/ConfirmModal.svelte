<script lang="ts">
	import { uiStore } from '../stores/uiStore.svelte.ts';
</script>

{#if uiStore.modal.open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="presentation"
		onclick={() => uiStore.closeModal()}
		onkeydown={(event: KeyboardEvent) => event.key === 'Escape' && uiStore.closeModal()}
	>
		<div
			class="bg-base-100 rounded-lg shadow-xl p-6 w-full max-w-sm"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(event: MouseEvent) => event.stopPropagation()}
			onkeydown={(event: KeyboardEvent) => event.stopPropagation()}
		>
			<h3 class="text-lg font-bold mb-2">{uiStore.modal.title}</h3>
			<p class="text-sm opacity-70 mb-4">{uiStore.modal.message}</p>
			<div class="flex justify-end gap-2">
				<button class="btn btn-sm btn-ghost" onclick={() => uiStore.closeModal()}>Cancel</button>
				<button class="btn btn-sm btn-error" onclick={() => uiStore.confirmModal()}>
					{uiStore.modal.confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
