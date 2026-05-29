// @ts-check

/** @typedef {import("../../types.js").PerFileTreeState} PerFileTreeState */
/** @typedef {import("../../types.js").WindowState} WindowState */
/** @typedef {import("../../types.js").PersistedUIState} PersistedUIState */

const STORAGE_KEY = "justbookmarks.ui-state.v1";
const MAX_FILE_STATES = 10;

/** @type {PersistedUIState} */
const defaultState = {
  lastOpenedFile: "",
  leftPaneWidth: 360,
  window: null,
  files: {},
};

/**
 * @returns {boolean}
 */
function hasStorage() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/**
 * @param {unknown} raw
 * @returns {PersistedUIState}
 */
function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...defaultState };
  }

  /** @type {Partial<PersistedUIState>} */
  const candidate = raw;
  /** @type {Record<string, PerFileTreeState>} */
  const files = {};

  if (candidate.files && typeof candidate.files === "object") {
    for (const [path, state] of Object.entries(candidate.files)) {
      if (!state || typeof state !== "object") {
        continue;
      }

      /** @type {Partial<PerFileTreeState>} */
      const fileState = state;
      files[path] = {
        expandedNodeIds: Array.isArray(fileState.expandedNodeIds)
          ? fileState.expandedNodeIds.filter((id) => typeof id === "string")
          : [],
        selectedNodeId:
          typeof fileState.selectedNodeId === "string"
            ? fileState.selectedNodeId
            : "",
      };
    }
  }

  const windowState = candidate.window;
  return {
    lastOpenedFile:
      typeof candidate.lastOpenedFile === "string"
        ? candidate.lastOpenedFile
        : "",
    leftPaneWidth:
      typeof candidate.leftPaneWidth === "number"
        ? candidate.leftPaneWidth
        : defaultState.leftPaneWidth,
    window:
      windowState &&
      typeof windowState === "object" &&
      typeof windowState.width === "number" &&
      typeof windowState.height === "number"
        ? {
            width: windowState.width,
            height: windowState.height,
          }
        : null,
    files,
  };
}

/**
 * @returns {PersistedUIState}
 */
export function loadPersistedUIState() {
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

/**
 * @param {PersistedUIState} state
 * @returns {void}
 */
export function savePersistedUIState(state) {
  if (!hasStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort persistence only.
  }
}

/**
 * @param {string} path
 * @returns {PersistedUIState}
 */
export function setLastOpenedFile(path) {
  const state = loadPersistedUIState();
  const nextState = { ...state, lastOpenedFile: path };
  savePersistedUIState(nextState);
  return nextState;
}

/**
 * @returns {PersistedUIState}
 */
export function clearLastOpenedFile() {
  return setLastOpenedFile("");
}

/**
 * @param {number} width
 * @returns {PersistedUIState}
 */
export function setLeftPaneWidth(width) {
  const state = loadPersistedUIState();
  const nextState = { ...state, leftPaneWidth: width };
  savePersistedUIState(nextState);
  return nextState;
}

/**
 * @param {WindowState | null} windowState
 * @returns {PersistedUIState}
 */
export function setWindowState(windowState) {
  const state = loadPersistedUIState();
  const nextState = { ...state, window: windowState };
  savePersistedUIState(nextState);
  return nextState;
}

/**
 * @param {string} path
 * @param {PerFileTreeState} treeState
 * @returns {PersistedUIState}
 */
export function setPerFileTreeState(path, treeState) {
  const state = loadPersistedUIState();
  const files = { ...state.files, [path]: treeState };
  const orderedPaths = Object.keys(files);

  if (orderedPaths.length > MAX_FILE_STATES) {
    for (const stalePath of orderedPaths.slice(
      0,
      orderedPaths.length - MAX_FILE_STATES,
    )) {
      delete files[stalePath];
    }
  }

  const nextState = { ...state, files };
  savePersistedUIState(nextState);
  return nextState;
}
