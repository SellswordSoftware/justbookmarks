// @ts-check

/**
 * Hybrid local runtime for the Wails frontend.
 *
 * This file now contains both:
 * - the original reactive/DOM helpers from `naf-html.js`
 * - the newer template/component helpers introduced for module-local markup
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
 * Attach an event listener and return a cleanup function.
 *
 * Designed to be used with `cleanupCollector()` so that listeners
 * are automatically removed on unmount without manual pairing.
 *
 * Example:
 *   cleanup.add(listener(btn, "click", handleClick));
 *
 * @template {EventTarget} [T=EventTarget]
 * @param {T | null | undefined} el
 * @param {string} event
 * @param {(...args: any[]) => void} handler
 * @returns {() => void}
 */
export function listener(el, event, handler) {
  el?.addEventListener(event, handler);
  return () => el?.removeEventListener(event, handler);
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
 * Show element when condition signal is truthy.
 *
 * Reactive -- re-evaluates when condition changes.
 * Null-safe -- returns no-op cleanup when element is missing.
 *
 * @param {HTMLElement | null | undefined} el
 * @param {() => any} condition
 * @returns {() => void}
 */
export function show(el, condition) {
  if (!el) {
    return () => {};
  }
  return effect(() => { el.hidden = !condition(); });
}

/**
 * Hide element when condition signal is truthy.
 *
 * Reactive -- re-evaluates when condition changes.
 * Null-safe -- returns no-op cleanup when element is missing.
 *
 * @param {HTMLElement | null | undefined} el
 * @param {() => any} condition
 * @returns {() => void}
 */
export function hide(el, condition) {
  if (!el) {
    return () => {};
  }
  return effect(() => { el.hidden = condition(); });
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
 * Create an HTMLTemplateElement from a raw HTML string.
 *
 * @param {string} html
 * @returns {HTMLTemplateElement}
 */
function createTemplateFromString(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template;
}

/**
 * Virtual scrolling options for list().
 * @typedef {object} VirtualOptions
 * @property {number} rowHeight - Fixed pixel height per row.
 */

/**
 * List render options.
 * @typedef {object} ListOptions
 * @property {VirtualOptions} [virtual] - Enable virtual scrolling.
 */

/**
 * Render a keyed list from a template element or HTML string.
 * Supports virtual scrolling via the optional `options` parameter.
 *
 * @template T
 * @param {Element | null} container
 * @param {HTMLTemplateElement | string | null} templateEl
 * @param {() => T[]} items
 * @param {(item: T) => string | number} key
 * @param {(el: Element, item: () => T, index: () => number) => void | (() => void)} setup
 * @param {ListOptions} [options]
 * @returns {() => void}
 */
export function list(container, templateEl, items, key, setup, options) {
  if (!container || !templateEl) {
    return () => {};
  }

  /** @type {HTMLTemplateElement} */
  const tpl = typeof templateEl === "string"
    ? createTemplateFromString(templateEl)
    : templateEl;

  /** @type {VirtualOptions | undefined} */
  const virtualOpts = options?.virtual;
  const isVirtual = !!virtualOpts;
  const rowHeight = isVirtual ? virtualOpts.rowHeight : 0;

  // --- Virtual scrolling mode ---
  if (isVirtual && rowHeight > 0) {
    return listVirtual(/** @type {HTMLElement} */ (container), tpl, items, key, setup, rowHeight);
  }

  // --- Standard (full render) mode ---
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
        const el = /** @type {Element} */ (tpl.content.firstElementChild?.cloneNode(true));
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
 * Internal: virtual-scrolling list renderer.
 * Only creates DOM nodes for the visible viewport. Uses a spacer element
 * for scroll height and translateY for row positioning.
 *
 * @template T
 * @param {HTMLElement} container
 * @param {HTMLTemplateElement} tpl
 * @param {() => T[]} items
 * @param {(item: T) => string | number} key
 * @param {(el: Element, item: () => T, index: () => number) => void | (() => void)} setup
 * @param {number} rowHeight
 * @returns {() => void}
 */
function listVirtual(container, tpl, items, key, setup, rowHeight) {
  // Set up the scrollable container
  container.style.overflowY = "auto";
  container.style.position = "relative";

  // Spacer element: provides the scrollable height
  const spacer = document.createElement("div");
  spacer.style.position = "absolute";
  spacer.style.top = "0";
  spacer.style.left = "0";
  spacer.style.width = "100%";
  container.appendChild(spacer);

  /** @type {Map<string | number, { el: HTMLElement, item: Signal<T>, index: Signal<number>, cleanup?: () => void }>} */
  const entries = new Map();

  /**
   * Calculate which items are visible in the current viewport.
   * @returns {{ start: number, end: number }}
   */
  function getVisibleRange() {
    const totalItems = items().length;
    if (totalItems === 0) {
      return { start: 0, end: 0 };
    }
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const bufferSize = Math.max(3, Math.floor(viewportHeight / rowHeight));

    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferSize);
    const endIdx = Math.min(totalItems, Math.ceil((scrollTop + viewportHeight) / rowHeight) + bufferSize);

    return { start: startIdx, end: endIdx };
  }

  /**
   * Update the virtual list: create/remove/position rows for the visible range.
   */
  function updateVirtualList() {
    const arr = items();
    const totalItems = arr.length;

    // Update spacer height
    spacer.style.height = `${totalItems * rowHeight}px`;

    const { start, end } = getVisibleRange();
    const visibleKeys = new Set();

    for (let i = start; i < end; i++) {
      const item = arr[i];
      const entryKey = key(item);
      visibleKeys.add(entryKey);

      let entry = entries.get(entryKey);

      if (!entry) {
        const el = /** @type {HTMLElement} */ (tpl.content.firstElementChild?.cloneNode(true));
        el.style.position = "absolute";
        el.style.top = `${i * rowHeight}px`;
        el.style.left = "0";
        el.style.width = "100%";
        el.style.height = `${rowHeight}px`;

        const itemSig = signal(item);
        const indexSig = signal(i);
        entry = { el, item: itemSig, index: indexSig };
        entries.set(entryKey, entry);

        const cleanup = setup(el, () => itemSig(), () => indexSig());
        if (cleanup) {
          entry.cleanup = cleanup;
        }

        spacer.appendChild(el);
      } else {
        entry.item(item);
        entry.index(i);
        // Update position in case items shifted
        entry.el.style.top = `${i * rowHeight}px`;
      }
    }

    // Remove entries that are no longer visible
    for (const [entryKey, entry] of entries) {
      if (!visibleKeys.has(entryKey)) {
        entry.cleanup?.();
        entry.el.remove();
        entries.delete(entryKey);
      }
    }
  }

  // Scroll listener with requestAnimationFrame throttling
  let scrollTick = false;
  const onScroll = () => {
    if (!scrollTick) {
      scrollTick = true;
      requestAnimationFrame(() => {
        updateVirtualList();
        scrollTick = false;
      });
    }
  };
  container.addEventListener("scroll", onScroll, { passive: true });

  // Reactive effect: re-render when items change
  const stopEffect = effect(() => {
    updateVirtualList();
  });

  // Initial render
  updateVirtualList();

  return () => {
    stopEffect();
    container.removeEventListener("scroll", onScroll);
    for (const entry of entries.values()) {
      entry.cleanup?.();
      entry.el.remove();
    }
    entries.clear();
    spacer.remove();
    // Reset container styles
    container.style.overflowY = "";
    container.style.position = "";
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

/**
 * @template {Element} [T=Element]
 * @typedef {object} Component
 * @property {string} html
 * @property {T=} el
 * @property {Record<string, Element>} refs
 * @property {(parent: Element) => void} mount
 * @property {(() => void)=} unmount
 */

/**
 * @template {Element} [T=Element]
 * @typedef {object} TemplateOptions
 * @property {string=} root
 * @property {(el: T | undefined, parent: Element, ctx: ComponentContext<T>) => void=} onMount
 * @property {(ctx: ComponentContext<T>) => void=} onUnmount
 */

/**
 * @typedef {Component | string | number | boolean | null | undefined | ReturnType<typeof raw>} TemplateValue
 */

/**
 * @typedef {{ id: number, component: Component }} ComponentSlot
 */

/**
 * @template {Element} [T=Element]
 * @typedef {object} ComponentContext
 * @property {Element} host
 * @property {T | undefined} root
 * @property {Record<string, Element>} refs
 * @property {{ add: (...cleanups: Array<(() => void) | null | undefined | false>) => void, run: () => void }} cleanup
 * @property {Component<T>} component
 */

/**
 * @param {unknown} value
 * @returns {value is Component}
 */
function isComponent(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "html" in value &&
      "mount" in value &&
      typeof value.html === "string" &&
      typeof value.mount === "function",
  );
}

/**
 * Mark a string as safe raw HTML for template interpolation.
 * Use this when you intentionally want to inject HTML fragments.
 *
 * @param {string} html
 * @returns {{ __raw: true, html: string }}
 */
export function raw(html) {
  return { __raw: true, html };
}

/**
 * @param {unknown} value
 * @returns {value is { __raw: true, html: string }}
 */
function isRawHtml(value) {
  return (
    value != null &&
    typeof value === "object" &&
    "__raw" in value &&
    value.__raw === true &&
    "html" in value
  );
}

/**
 * @param {TemplateStringsArray} strings
 * @param {TemplateValue[]} values
 * @returns {{ html: string, components: ComponentSlot[] }}
 */
function buildTemplate(strings, values) {
  /** @type {ComponentSlot[]} */
  const components = [];
  /** @type {string[]} */
  const parts = [strings[0] ?? ""];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (isComponent(value)) {
      const id = slotId++;
      components.push({ id, component: value });
      parts.push(
        `<span data-naf-component-slot="${id}" style="display: contents;"></span>`,
      );
    } else if (isRawHtml(value)) {
      parts.push(value.html);
    } else if (typeof value === "string") {
      parts.push(text(value));
    } else if (value !== null && value !== undefined && value !== false) {
      parts.push(text(String(value)));
    }
    parts.push(strings[index + 1] ?? "");
  }

  return {
    html: parts.join(""),
    components,
  };
}

/**
 * @param {Element[]} elements
 * @returns {Record<string, Element>}
 */
function collectRefs(elements) {
  /** @type {Record<string, Element>} */
  const refs = {};

  for (const element of elements) {
    const name = element.getAttribute("data-ref");
    if (name) {
      if (refs[name]) {
        throw new Error(`Duplicate data-ref found: ${name}`);
      }
      refs[name] = element;
    }

    for (const child of element.querySelectorAll("[data-ref]")) {
      const childName = child.getAttribute("data-ref");
      if (!childName) {
        continue;
      }
      if (refs[childName]) {
        throw new Error(`Duplicate data-ref found: ${childName}`);
      }
      refs[childName] = child;
    }
  }

  return refs;
}

/**
 * @param {string} html
 * @returns {DocumentFragment}
 */
function createFragment(html) {
  tempDiv.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }
  return fragment;
}

/**
 * @param {Element[]} elements
 * @param {string} selector
 * @returns {Element | undefined}
 */
function findScopedElement(elements, selector) {
  for (const element of elements) {
    if (element.matches(selector)) {
      return element;
    }

    const nested = element.querySelector(selector);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

/**
 * @param {Element} host
 * @param {DocumentFragment} fragment
 * @returns {Element[]}
 */
function mountFragment(host, fragment) {
  const elements = /** @type {Element[]} */ (
    Array.from(fragment.childNodes).filter((node) => node instanceof Element)
  );
  host.appendChild(fragment);
  return elements;
}

/**
 * @template {Element} T
 * @param {string} html
 * @param {ComponentSlot[]} components
 * @param {TemplateOptions<T>=} options
 * @returns {Component<T>}
 */
function createComponent(html, components, options) {
  const cleanup = cleanupCollector();
  /** @type {ComponentContext<T> | undefined} */
  let context;
  /** @type {Element[]} */
  let mountedElements = [];

  /** @type {Component<T>} */
  const component = {
    html,
    el: undefined,
    refs: {},
    mount(parent) {
      const fragment = createFragment(html);
      mountedElements = mountFragment(parent, fragment);

      if (options?.root) {
        const found = findScopedElement(mountedElements, options.root);
        if (!found) {
          throw new Error(`Element not found for selector: ${options.root}`);
        }
        component.el = /** @type {T} */ (found);
      }

      component.refs = collectRefs(mountedElements);
      context = {
        host: parent,
        root: component.el,
        refs: component.refs,
        cleanup,
        component,
      };

      options?.onMount?.(component.el, parent, context);

      for (const childSlot of components) {
        const slotHost = findScopedElement(
          mountedElements,
          `[data-naf-component-slot="${childSlot.id}"]`,
        );
        if (!(slotHost instanceof HTMLElement)) {
          throw new Error(`Component slot host not found: ${childSlot.id}`);
        }
        childSlot.component.mount(slotHost);
      }
    },
    unmount() {
      for (const childSlot of components) {
        childSlot.component.unmount?.();
      }
      if (options?.onUnmount && context) {
        options.onUnmount(context);
      }
      cleanup.run();
      for (const element of mountedElements) {
        element.remove();
      }
      component.el = undefined;
      component.refs = {};
      mountedElements = [];
      context = undefined;
    },
  };

  return component;
}

let slotId = 0;
const tempDiv = document.createElement("div");

/**
 * @param {Comment} placeholder
 * @param {string} commentId
 * @param {string} html
 * @returns {void}
 */
function updateSlotContent(placeholder, commentId, html) {
  const parent = placeholder.parentNode;
  if (!(parent instanceof Element)) {
    throw new Error("Reactive slot placeholder is not attached to an element parent");
  }

  /** @type {ChildNode | null} */
  let node = placeholder.nextSibling;
  while (node && node.textContent !== `/naf-${commentId}`) {
    node = node.nextSibling;
  }

  const end = node;
  if (!(end instanceof Comment)) {
    throw new Error(`Could not find end marker for reactive slot naf-${commentId}`);
  }

  node = placeholder.nextSibling;
  while (node && node !== end) {
    const next = node.nextSibling;
    parent.removeChild(node);
    node = next;
  }

  if (html) {
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
      parent.insertBefore(tempDiv.firstChild, end);
    }
  }
}

/**
 * @param {(placeholder: Comment) => () => void} setupEffect
 * @returns {Component}
 */
function reactiveSlot(setupEffect) {
  const id = slotId++;
  /** @type {(() => void) | undefined} */
  let cleanup;
  const html = `<!--naf-${id}--><!--/naf-${id}-->`;

  return {
    html,
    refs: {},
    mount(parent) {
      if (!parent.innerHTML) {
        parent.innerHTML = html;
      }

      const walker = document.createTreeWalker(parent, NodeFilter.SHOW_COMMENT);
      /** @type {Comment | null} */
      let start = null;
      /** @type {Comment | null} */
      let end = null;
      /** @type {Node | null} */
      let current;

      while ((current = walker.nextNode())) {
        if (current.textContent === `naf-${id}`) {
          start = /** @type {Comment} */ (current);
        } else if (current.textContent === `/naf-${id}`) {
          end = /** @type {Comment} */ (current);
          break;
        }
      }

      if (!start || !end) {
        throw new Error(`Could not find placeholder comments: naf-${id}`);
      }

      cleanup = setupEffect(start);
    },
    unmount() {
      cleanup?.();
    },
  };
}

/**
 * @template {Element} [T=Element]
 * @param {TemplateOptions<T> | TemplateStringsArray} optionsOrStrings
 * @param {...TemplateValue} valuesOrNothing
 * @returns {Component<T> | ((strings: TemplateStringsArray, ...values: TemplateValue[]) => Component<T>)}
 */
export function template(optionsOrStrings, ...valuesOrNothing) {
  if (
    !Array.isArray(optionsOrStrings) &&
    typeof optionsOrStrings === "object" &&
    optionsOrStrings !== null &&
    !("raw" in optionsOrStrings)
  ) {
    const options = /** @type {TemplateOptions<T>} */ (optionsOrStrings);
    return (strings, ...values) => {
      const { html, components } = buildTemplate(strings, values);
      return createComponent(html, components, options);
    };
  }

  const strings = /** @type {TemplateStringsArray} */ (optionsOrStrings);
  const { html, components } = buildTemplate(strings, valuesOrNothing);
  return createComponent(html, components);
}

/**
 * Mount a component into a dedicated host and replace any existing host content.
 *
 * @template {Element} [T=Element]
 * @param {Component<T>} component
 * @param {Element | null} host
 * @returns {Component<T>}
 */
export function mount(component, host) {
  if (!host) {
    throw new Error("Expected host element for component mount");
  }

  host.replaceChildren();
  component.mount(host);
  return component;
}

/**
 * @template T
 * @param {() => T} condition
 * @param {(value: T) => Component} thenBranch
 * @param {(value: T) => Component=} elseBranch
 * @returns {Component}
 */
export function when(condition, thenBranch, elseBranch) {
  /** @type {Component | undefined} */
  let currentComponent;
  /** @type {unknown} */
  let previousValue;
  /** @type {boolean | undefined} */
  let previousBranch;
  let initialized = false;

  return reactiveSlot((placeholder) => {
    const commentId = placeholder.textContent?.replace("naf-", "") || "0";
    const whenSlotId = slotId++;

    const stop = effect(() => {
      const value = condition();
      const branch = Boolean(value);

      if (initialized && previousBranch === branch && previousValue === value) {
        return;
      }

      initialized = true;
      previousBranch = branch;
      previousValue = value;

      currentComponent?.unmount?.();
      currentComponent = branch ? thenBranch(value) : elseBranch?.(value);
      const parent = placeholder.parentNode;
      if (!(parent instanceof Element)) {
        throw new Error("Reactive slot placeholder is not attached to an element parent");
      }
      updateSlotContent(
        placeholder,
        commentId,
        currentComponent
          ? `<span data-naf-when-slot="${whenSlotId}" style="display: contents;"></span>`
          : "",
      );

      if (!currentComponent) {
        return;
      }

      const slotHost = parent.querySelector(
        `[data-naf-when-slot="${whenSlotId}"]`,
      );
      if (!(slotHost instanceof HTMLElement)) {
        throw new Error("Reactive slot host not found");
      }
      currentComponent.mount(slotHost);
    });

    return () => {
      stop();
      currentComponent?.unmount?.();
    };
  });
}

/**
 * @param {Element | null | undefined} el
 * @param {string} name
 * @param {() => string | boolean | null} value
 * @returns {() => void}
 */
export function attr(el, name, value) {
  if (!el) {
    return () => {};
  }

  return effect(() => {
    const nextValue = value();
    if (nextValue === false || nextValue === null) {
      el.removeAttribute(name);
    } else if (nextValue === true) {
      el.setAttribute(name, "");
    } else {
      el.setAttribute(name, String(nextValue));
    }
  });
}

/**
 * @param {Element | null | undefined} el
 * @param {() => unknown} getter
 * @returns {() => void}
 */
export function setText(el, getter) {
  if (!el) {
    return () => {};
  }

  return effect(() => {
    el.textContent = String(getter());
  });
}
