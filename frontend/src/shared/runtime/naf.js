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
 * @typedef {Component | string | number | boolean | null | undefined} TemplateValue
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
 * @param {TemplateStringsArray} strings
 * @param {TemplateValue[]} values
 * @returns {{ html: string, components: Component[] }}
 */
function buildTemplate(strings, values) {
  /** @type {Component[]} */
  const components = [];
  /** @type {string[]} */
  const parts = [strings[0] ?? ""];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (isComponent(value)) {
      components.push(value);
      parts.push(value.html);
    } else if (typeof value === "string") {
      parts.push(value);
    } else if (value !== null && value !== undefined && value !== false) {
      parts.push(String(value));
    }
    parts.push(strings[index + 1] ?? "");
  }

  return {
    html: parts.join(""),
    components,
  };
}

/**
 * @param {Element} host
 * @returns {Record<string, Element>}
 */
function collectRefs(host) {
  /** @type {Record<string, Element>} */
  const refs = {};

  for (const element of host.querySelectorAll("[data-ref]")) {
    const name = element.getAttribute("data-ref");
    if (!name) {
      continue;
    }
    if (refs[name]) {
      throw new Error(`Duplicate data-ref found: ${name}`);
    }
    refs[name] = element;
  }

  return refs;
}

/**
 * @template {Element} T
 * @param {string} html
 * @param {Component[]} components
 * @param {TemplateOptions<T>=} options
 * @returns {Component<T>}
 */
function createComponent(html, components, options) {
  const cleanup = cleanupCollector();
  /** @type {ComponentContext<T> | undefined} */
  let context;

  /** @type {Component<T>} */
  const component = {
    html,
    el: undefined,
    refs: {},
    mount(parent) {
      if (!parent.innerHTML) {
        parent.innerHTML = html;
      }

      for (const child of components) {
        child.mount(parent);
      }

      if (options?.root) {
        const found = parent.querySelector(options.root);
        if (!found) {
          throw new Error(`Element not found for selector: ${options.root}`);
        }
        component.el = /** @type {T} */ (found);
      }

      component.refs = collectRefs(parent);
      context = {
        host: parent,
        root: component.el,
        refs: component.refs,
        cleanup,
        component,
      };

      options?.onMount?.(component.el, parent, context);
    },
    unmount() {
      for (const child of components) {
        child.unmount?.();
      }
      if (options?.onUnmount && context) {
        options.onUnmount(context);
      }
      cleanup.run();
      component.el = undefined;
      component.refs = {};
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

  return reactiveSlot((placeholder) => {
    const commentId = placeholder.textContent?.replace("naf-", "") || "0";

    const stop = effect(() => {
      currentComponent?.unmount?.();
      const value = condition();
      currentComponent = value ? thenBranch(value) : elseBranch?.(value);

      updateSlotContent(placeholder, commentId, currentComponent?.html ?? "");

      const parent = placeholder.parentNode;
      if (!(parent instanceof Element)) {
        throw new Error("Reactive slot placeholder is not attached to an element parent");
      }

      currentComponent?.mount(parent);
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
