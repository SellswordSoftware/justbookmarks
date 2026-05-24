const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
		return !element.hasAttribute('disabled') && element.offsetParent !== null;
	});
}

export function trapFocusInContainer(event: KeyboardEvent, container: HTMLElement | null | undefined): boolean {
	if (event.key !== 'Tab' || !container) {
		return false;
	}

	const focusable = getFocusableElements(container);
	if (focusable.length === 0) {
		event.preventDefault();
		container.focus();
		return true;
	}

	const activeElement = document.activeElement as HTMLElement | null;
	const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;

	if (event.shiftKey) {
		if (currentIndex <= 0) {
			event.preventDefault();
			focusable[focusable.length - 1].focus();
			return true;
		}
		return false;
	}

	if (currentIndex === -1 || currentIndex >= focusable.length - 1) {
		event.preventDefault();
		focusable[0].focus();
		return true;
	}

	return false;
}
