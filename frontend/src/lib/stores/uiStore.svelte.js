// UI store — singleton managing toasts and modal dialogs.
// Uses Svelte 5 runes ($state) — must be processed by the Svelte compiler.

let toasts = $state([]);
let modal = $state({
	open: false,
	title: '',
	message: '',
	confirmLabel: 'OK',
	onConfirm: null,
});

function showToast(message, type = 'info', duration = 4000) {
	const id = Date.now() + Math.random();
	toasts.push({ id, message, type });
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, duration);
}

function showConfirm(title, message, confirmLabel = 'OK', onConfirm = null) {
	modal = { open: true, title, message, confirmLabel, onConfirm };
}

function closeModal() {
	modal = { open: false, title: '', message: '', confirmLabel: 'OK', onConfirm: null };
}

function confirmModal() {
	if (modal.onConfirm) modal.onConfirm();
	closeModal();
}

export const uiStore = {
	get toasts() { return toasts; },
	get modal() { return modal; },
	showToast,
	showConfirm,
	closeModal,
	confirmModal,
};
