import type {
	ConfirmCallback,
	ConfirmModalState,
	Toast,
	ToastType,
} from '../types';

let toasts = $state<Toast[]>([]);
let modal = $state<ConfirmModalState>({
	open: false,
	title: '',
	message: '',
	confirmLabel: 'OK',
	onConfirm: null,
});

function showToast(message: string, type: ToastType = 'info', duration = 4000): void {
	const id = Date.now() + Math.random();
	toasts.push({ id, message, type });

	setTimeout(() => {
		toasts = toasts.filter((toast) => toast.id !== id);
	}, duration);
}

function showConfirm(
	title: string,
	message: string,
	confirmLabel = 'OK',
	onConfirm: ConfirmCallback = null,
): void {
	modal = { open: true, title, message, confirmLabel, onConfirm };
}

function closeModal(): void {
	modal = { open: false, title: '', message: '', confirmLabel: 'OK', onConfirm: null };
}

async function confirmModal(): Promise<void> {
	try {
		await modal.onConfirm?.();
	} finally {
		closeModal();
	}
}

export const uiStore = {
	get toasts(): Toast[] {
		return toasts;
	},
	get modal(): ConfirmModalState {
		return modal;
	},
	showToast,
	showConfirm,
	closeModal,
	confirmModal,
};
