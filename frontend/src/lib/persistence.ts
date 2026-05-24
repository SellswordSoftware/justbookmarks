const STORAGE_KEY = 'justbookmarks.ui-state.v1';
const MAX_FILE_STATES = 10;

export interface PerFileTreeState {
	expandedNodeIds: string[];
	selectedNodeId: string;
}

export interface WindowState {
	width: number;
	height: number;
}

export interface PersistedUIState {
	lastOpenedFile: string;
	leftPaneWidth: number;
	window: WindowState | null;
	files: Record<string, PerFileTreeState>;
}

const defaultState: PersistedUIState = {
	lastOpenedFile: '',
	leftPaneWidth: 360,
	window: null,
	files: {},
};

function hasStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sanitizeState(raw: unknown): PersistedUIState {
	if (!raw || typeof raw !== 'object') {
		return { ...defaultState };
	}

	const candidate = raw as Partial<PersistedUIState>;
	const files: Record<string, PerFileTreeState> = {};
	if (candidate.files && typeof candidate.files === 'object') {
		for (const [path, state] of Object.entries(candidate.files)) {
			if (!state || typeof state !== 'object') continue;
			const fileState = state as Partial<PerFileTreeState>;
			files[path] = {
				expandedNodeIds: Array.isArray(fileState.expandedNodeIds)
					? fileState.expandedNodeIds.filter((id): id is string => typeof id === 'string')
					: [],
				selectedNodeId: typeof fileState.selectedNodeId === 'string' ? fileState.selectedNodeId : '',
			};
		}
	}

	const windowState = candidate.window;
	return {
		lastOpenedFile: typeof candidate.lastOpenedFile === 'string' ? candidate.lastOpenedFile : '',
		leftPaneWidth: typeof candidate.leftPaneWidth === 'number' ? candidate.leftPaneWidth : defaultState.leftPaneWidth,
		window:
			windowState &&
			typeof windowState === 'object' &&
			typeof (windowState as WindowState).width === 'number' &&
			typeof (windowState as WindowState).height === 'number'
				? {
						width: (windowState as WindowState).width,
						height: (windowState as WindowState).height,
					}
				: null,
		files,
	};
}

export function loadPersistedUIState(): PersistedUIState {
	if (!hasStorage()) {
		return { ...defaultState };
	}

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return { ...defaultState };
		}
		return sanitizeState(JSON.parse(raw));
	} catch {
		return { ...defaultState };
	}
}

export function savePersistedUIState(state: PersistedUIState): void {
	if (!hasStorage()) return;

	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Best-effort persistence only.
	}
}

export function setLastOpenedFile(path: string): PersistedUIState {
	const state = loadPersistedUIState();
	const nextState = { ...state, lastOpenedFile: path };
	savePersistedUIState(nextState);
	return nextState;
}

export function setLeftPaneWidth(width: number): PersistedUIState {
	const state = loadPersistedUIState();
	const nextState = { ...state, leftPaneWidth: width };
	savePersistedUIState(nextState);
	return nextState;
}

export function setWindowState(windowState: WindowState | null): PersistedUIState {
	const state = loadPersistedUIState();
	const nextState = { ...state, window: windowState };
	savePersistedUIState(nextState);
	return nextState;
}

export function setPerFileTreeState(path: string, treeState: PerFileTreeState): PersistedUIState {
	const state = loadPersistedUIState();
	const files = { ...state.files, [path]: treeState };
	const orderedPaths = Object.keys(files);
	if (orderedPaths.length > MAX_FILE_STATES) {
		for (const stalePath of orderedPaths.slice(0, orderedPaths.length - MAX_FILE_STATES)) {
			delete files[stalePath];
		}
	}

	const nextState = { ...state, files };
	savePersistedUIState(nextState);
	return nextState;
}
