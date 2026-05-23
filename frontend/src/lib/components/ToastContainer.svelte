<script>
	import { uiStore } from '../stores/uiStore.svelte.js';

	const typeClasses = {
		info: 'toast-info',
		success: 'toast-success',
		error: 'toast-error',
		warning: 'toast-warning',
	};
</script>

<div class="toast toast-end toast-bottom z-50">
	{#each uiStore.toasts as toast (toast.id)}
		<div class={`alert ${typeClasses[toast.type] || typeClasses.info} shadow-lg`} role="alert">
			<span class="text-sm">{toast.message}</span>
		</div>
	{/each}
</div>
