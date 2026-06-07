// @ts-check

/**
 * @returns {any | null}
 */
function getTauriGlobal() {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window.__TAURI__;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate;
}

/**
 * @returns {{ windowApi: any | null, webviewWindowApi: any | null, dpiApi: any | null }}
 */
function getTauriWindowApis() {
  const tauri = getTauriGlobal();
  return {
    windowApi: tauri?.window ?? null,
    webviewWindowApi: tauri?.webviewWindow ?? null,
    dpiApi: tauri?.dpi ?? null,
  };
}

/**
 * @returns {any | null}
 */
function getCurrentWindow() {
  const { windowApi, webviewWindowApi } = getTauriWindowApis();

  try {
    if (webviewWindowApi?.getCurrentWebviewWindow) {
      return webviewWindowApi.getCurrentWebviewWindow();
    }
  } catch {
    // Fall through to the regular window API.
  }

  try {
    if (windowApi?.getCurrentWindow) {
      return windowApi.getCurrentWindow();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * @param {(() => void) | Promise<unknown>} result
 * @returns {(() => void) | null}
 */
function getEventUnlistenHandle(result) {
  if (typeof result === "function") {
    return result;
  }
  if (result && typeof result.then === "function") {
    return async () => {
      const unlisten = await result;
      if (typeof unlisten === "function") {
        await unlisten();
      }
    };
  }
  return null;
}

/** @returns {boolean} */
export function hasNativeWindowHost() {
  const currentWindow = getCurrentWindow();
  return Boolean(
    // window.__TAURI__?.core?.invoke &&
    currentWindow &&
    typeof currentWindow.minimize === "function" &&
    typeof currentWindow.close === "function"
  );
}

/** @returns {boolean} */
export function canResizeWindow() {
  const currentWindow = getCurrentWindow();
  return Boolean(currentWindow && typeof currentWindow.startResizeDragging === "function");
}

/** @returns {Promise<void>} */
export async function minimiseWindow() {
  const currentWindow = getCurrentWindow();
  if (!currentWindow?.minimize) {
    return;
  }
  await currentWindow.minimize();
}

/** @returns {Promise<void>} */
export async function toggleMaximiseWindow() {
  const currentWindow = getCurrentWindow();
  if (!currentWindow?.toggleMaximize) {
    return;
  }
  await currentWindow.toggleMaximize();
}

/** @returns {Promise<boolean>} */
export async function isMaximised() {
  const currentWindow = getCurrentWindow();
  if (!currentWindow?.isMaximized) {
    return false;
  }
  return currentWindow.isMaximized();
}

/** @returns {Promise<boolean>} */
export async function isMinimised() {
  const currentWindow = getCurrentWindow();
  if (!currentWindow?.isMinimized) {
    return false;
  }
  return currentWindow.isMinimized();
}

/**
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export async function getWindowSize() {
  const currentWindow = getCurrentWindow();
  if (!currentWindow?.innerSize) {
    return null;
  }

  const size = await currentWindow.innerSize();
  return {
    width: size.width,
    height: size.height,
  };
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {Promise<void>}
 */
export async function setWindowSize(width, height) {
  const currentWindow = getCurrentWindow();
  const { dpiApi } = getTauriWindowApis();
  if (!currentWindow?.setSize || !dpiApi?.LogicalSize) {
    return;
  }

  await currentWindow.setSize(new dpiApi.LogicalSize(width, height));
}

/** @returns {Promise<void>} */
export async function closeApplication() {
  const currentWindow = getCurrentWindow();
  if (!currentWindow?.close) {
    return;
  }
  await currentWindow.close();
}

/**
 * Subscribe to native Tauri window events that should cause window-state resync.
 *
 * @param {() => void | Promise<void>} handler
 * @returns {() => void}
 */
export function subscribeWindowState(handler) {
  const currentWindow = getCurrentWindow();
  if (!currentWindow) {
    return () => {};
  }

  /** @type {Array<() => void | Promise<void>>} */
  const cleanups = [];
  /** @param {() => void | Promise<void>} maybeRegistration */
  const register = (maybeRegistration) => {
    const cleanup = getEventUnlistenHandle(maybeRegistration);
    if (cleanup) {
      cleanups.push(cleanup);
    }
  };

  try {
    if (typeof currentWindow.onResized === "function") {
      register(currentWindow.onResized(() => {
        void handler();
      }));
    }
    if (typeof currentWindow.onMoved === "function") {
      register(currentWindow.onMoved(() => {
        void handler();
      }));
    }
    if (typeof currentWindow.onFocusChanged === "function") {
      register(currentWindow.onFocusChanged(() => {
        void handler();
      }));
    }
  } catch {
    return () => {};
  }

  return () => {
    for (const cleanup of cleanups) {
      void cleanup();
    }
  };
}
