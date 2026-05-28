// @ts-check

/**
 * NAF-HTML - HTML-first reactive bindings.
 * Local JS port for the frontend migration.
 */

/**
 * @template T
 * @typedef {(() => T) & ((value: T) => T)} Signal
 */

/**
 * @template T
 * @typedef {() => T} Computed
 */

/** @typedef {Set<() => void>} Subs */

/** @type {(() => void) | undefined} */
let activeSub;

/** @type {Subs[] | undefined} */
let activeSets;

/**
 * @param {Subs} subs
 * @returns {void}
 */
function track(subs) {
  if (activeSub) {
    subs.add(activeSub);
    activeSets?.push(subs);
  }
}

/**
 * @param {Subs} subs
 * @returns {void}
 */
function notify(subs) {
  [...subs].forEach((fn) => fn());
}

/**
 * Creates a reactive signal that holds a value.
 *
 * @template T
 * @param {T} initialValue
 * @returns {Signal<T>}
 */
export function signal(initialValue) {
  let value = initialValue;
  /** @type {Subs} */
  const subs = new Set();

  /** @type {Signal<T>} */
  const sig = /** @type {Signal<T>} */ (function (newValue) {
    if (arguments.length > 0) {
      if (value !== newValue) {
        value = /** @type {T} */ (newValue);
        notify(subs);
      }
      return /** @type {T} */ (newValue);
    }

    track(subs);
    return value;
  });

  return sig;
}

/**
 * Creates a lazily recomputed derived value.
 *
 * @template T
 * @param {() => T} fn
 * @returns {Computed<T>}
 */
export function computed(fn) {
  /** @type {T} */
  let value;
  let dirty = true;
  /** @type {Subs} */
  const subs = new Set();
  /** @type {Subs[]} */
  const subscribedTo = [];

  const markDirty = () => {
    dirty = true;
    notify(subs);
  };

  return () => {
    track(subs);
    if (dirty) {
      const prevSub = activeSub;
      const prevSets = activeSets;
      subscribedTo.forEach((set) => set.delete(markDirty));
      subscribedTo.length = 0;
      activeSub = markDirty;
      activeSets = subscribedTo;
      try {
        value = fn();
        dirty = false;
      } finally {
        activeSub = prevSub;
        activeSets = prevSets;
      }
    }
    return value;
  };
}

/**
 * Runs a reactive effect immediately and whenever dependencies change.
 *
 * @param {() => void} fn
 * @returns {() => void}
 */
export function effect(fn) {
  let running = false;
  let disposed = false;
  /** @type {Subs[]} */
  const subscribedTo = [];

  const run = () => {
    if (running || disposed) {
      return;
    }
    running = true;

    subscribedTo.forEach((set) => set.delete(run));
    subscribedTo.length = 0;

    const prevSub = activeSub;
    const prevSets = activeSets;
    activeSub = run;
    activeSets = subscribedTo;
    try {
      fn();
    } finally {
      activeSub = prevSub;
      activeSets = prevSets;
      running = false;
    }
  };

  run();

  return () => {
    disposed = true;
    subscribedTo.forEach((set) => set.delete(run));
    subscribedTo.length = 0;
  };
}

/**
 * Escapes HTML for safe text insertion.
 *
 * @param {string} s
 * @returns {string}
 */
export function text(s) {
  return s.replace(/[&<>"']/g, (c) => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c] || c
    );
  });
}

/**
 * Query a single element.
 *
 * @template {Element} [T=Element]
 * @param {string} selector
 * @param {Element | Document} [root=document]
 * @returns {T | null}
 */
export function $(selector, root = document) {
  return /** @type {T | null} */ (root.querySelector(selector));
}

/**
 * Query multiple elements as an array.
 *
 * @template {Element} [T=Element]
 * @param {string} selector
 * @param {Element | Document} [root=document]
 * @returns {T[]}
 */
export function $$(selector, root = document) {
  return /** @type {T[]} */ (Array.from(root.querySelectorAll(selector)));
}

/**
 * Attach an event listener and return the original element.
 *
 * @template {Element} T
 * @param {T | null} el
 * @param {string} event
 * @param {(e: Event) => void} handler
 * @returns {T | null}
 */
export function $on(el, event, handler) {
  el?.addEventListener(event, handler);
  return el;
}

/**
 * Bind a reactive effect to an element.
 *
 * @template {Element} T
 * @param {T | null | undefined} el
 * @param {(el: T) => void} fn
 * @returns {() => void}
 */
export function fx(el, fn) {
  if (!el) {
    return () => {};
  }
  return effect(() => fn(el));
}

/**
 * Two-way bind a form control to a signal.
 *
 * @template {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} T
 * @template V
 * @param {T | null} el
 * @param {Signal<V>} sig
 * @param {{ reactive?: boolean }=} options
 * @returns {{ el: T | null, cleanup: () => void }}
 */
export function model(el, sig, options) {
  if (!el) {
    return { el: null, cleanup: () => {} };
  }

  const isCheckbox = el instanceof HTMLInputElement && el.type === "checkbox";
  const eventName = isCheckbox ? "change" : "input";

  if (isCheckbox) {
    el.checked = /** @type {boolean} */ (sig());
  } else {
    el.value = /** @type {string} */ (sig());
  }

  const handleInput = () => {
    if (isCheckbox) {
      sig(/** @type {V} */ (/** @type {unknown} */ (el.checked)));
    } else {
      sig(/** @type {V} */ (/** @type {unknown} */ (el.value)));
    }
  };

  el.addEventListener(eventName, handleInput);

  let stop = () => {};

  if (options?.reactive) {
    stop = effect(() => {
      const value = sig();
      if (isCheckbox) {
        el.checked = /** @type {boolean} */ (value);
      } else if (el.value !== value) {
        el.value = /** @type {string} */ (value);
      }
    });
  }

  return {
    el,
    cleanup() {
      stop();
      el.removeEventListener(eventName, handleInput);
    },
  };
}

/**
 * Render a keyed list from a template element.
 *
 * @template T
 * @param {Element | null} container
 * @param {HTMLTemplateElement | null} templateEl
 * @param {() => T[]} items
 * @param {(item: T) => string | number} key
 * @param {(el: Element, item: () => T, index: () => number) => void | (() => void)} setup
 * @returns {() => void}
 */
export function list(container, templateEl, items, key, setup) {
  if (!container || !templateEl) {
    return () => {};
  }

  /** @type {Map<string | number, { el: Element, item: Signal<T>, index: Signal<number>, cleanup?: () => void }>} */
  const entries = new Map();

  const stopEffect = effect(() => {
    const arr = items();
    const newKeys = new Set(arr.map(key));

    for (const [entryKey, entry] of entries) {
      if (!newKeys.has(entryKey)) {
        entry.cleanup?.();
        entry.el.remove();
        entries.delete(entryKey);
      }
    }

    /** @type {Element | null} */
    let prevEl = null;

    for (let i = 0; i < arr.length; i += 1) {
      const item = arr[i];
      const entryKey = key(item);
      let entry = entries.get(entryKey);

      if (!entry) {
        const el = /** @type {Element} */ (templateEl.content.firstElementChild?.cloneNode(true));
        const itemSig = signal(item);
        const indexSig = signal(i);
        entry = { el, item: itemSig, index: indexSig };
        entries.set(entryKey, entry);

        const cleanup = setup(
          el,
          () => itemSig(),
          () => indexSig(),
        );
        if (cleanup) {
          entry.cleanup = cleanup;
        }
      } else {
        entry.item(item);
        entry.index(i);
      }

      if (prevEl) {
        if (entry.el.previousElementSibling !== prevEl) {
          prevEl.after(entry.el);
        }
      } else if (entry.el !== container.firstElementChild) {
        container.prepend(entry.el);
      }

      prevEl = entry.el;
    }
  });

  return () => {
    stopEffect();
    for (const entry of entries.values()) {
      entry.cleanup?.();
      entry.el.remove();
    }
    entries.clear();
  };
}

/**
 * Create a cleanup collector for modules that register many effects/listeners.
 *
 * @param {...(() => void)} initial
 * @returns {{ add: (...cleanups: Array<(() => void) | null | undefined | false>) => void, run: () => void }}
 */
export function cleanupCollector(...initial) {
  /** @type {Array<() => void>} */
  const cleanups = initial.filter(Boolean);

  return {
    add(...nextCleanups) {
      for (const cleanup of nextCleanups) {
        if (cleanup) {
          cleanups.push(cleanup);
        }
      }
    },
    run() {
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
    },
  };
}
