// @ts-check

/**
 * Install a strict, import-time-only DOM shim for the Node test runner.
 *
 * This exists so browser-adjacent modules with tiny top-level `document`
 * references can still be imported in Node. It is intentionally *not* a fake
 * browser DOM. Any test that needs actual DOM behavior should run under the
 * browser harness.
 */
export function installStrictImportDOM() {
  const fakeDocument = createFakeDocument();

  /** @type {any} */ (globalThis).document = fakeDocument;
  /** @type {any} */ (globalThis).window = {
    ...(/** @type {any} */ (globalThis).window),
    document: fakeDocument,
    localStorage: null,
    go: undefined,
    runtime: undefined,
  };
}

function createFakeDocument() {
  return {
    /**
     * @param {string} tagName
     * @returns {Record<string, unknown>}
     */
    createElement(tagName) {
      if (typeof tagName !== "string" || tagName.length === 0) {
        throw createUnsupportedDOMError("document.createElement(<invalid>)");
      }
      return createFakeElement(tagName);
    },
    createTextNode(text = "") {
      return {
        nodeType: 3,
        nodeValue: String(text),
        textContent: String(text),
      };
    },
    createDocumentFragment() {
      return createFakeFragment();
    },
  };
}

/**
 * @param {string} tagName
 * @returns {Record<string, unknown>}
 */
function createFakeElement(tagName) {
  const normalizedTag = tagName.toUpperCase();
  const state = {
    textContent: "",
    innerHTML: "",
    className: "",
    firstChild: null,
  };

  const target = {
    nodeType: 1,
    tagName: normalizedTag,
    style: Object.create(null),
    childNodes: /** @type {unknown[]} */ ([]),
    children: /** @type {unknown[]} */ ([]),
    get textContent() {
      return state.textContent;
    },
    set textContent(value) {
      state.textContent = String(value ?? "");
    },
    get innerHTML() {
      return state.innerHTML;
    },
    set innerHTML(value) {
      state.innerHTML = String(value ?? "");
    },
    get className() {
      return state.className;
    },
    set className(value) {
      state.className = String(value ?? "");
    },
    get firstChild() {
      return state.firstChild;
    },
    set firstChild(value) {
      state.firstChild = value;
    },
    get content() {
      if (normalizedTag !== "TEMPLATE") {
        throw createUnsupportedDOMError(`${tagName}.content`);
      }
      return createFakeFragment();
    },
  };

  return new Proxy(target, {
    get(currentTarget, prop, receiver) {
      if (prop in currentTarget) {
        return Reflect.get(currentTarget, prop, receiver);
      }
      if (prop === Symbol.toStringTag) {
        return "FakeElement";
      }
      if (prop === "toString") {
        return () => `[FakeElement ${normalizedTag}]`;
      }
      if (typeof prop === "string") {
        return createUnsupportedDOMMethod(`${tagName}.${prop}`);
      }
      return undefined;
    },
  });
}

function createFakeFragment() {
  const target = {
    nodeType: 11,
    childNodes: /** @type {unknown[]} */ ([]),
  };

  return new Proxy(target, {
    get(currentTarget, prop, receiver) {
      if (prop in currentTarget) {
        return Reflect.get(currentTarget, prop, receiver);
      }
      if (prop === Symbol.toStringTag) {
        return "FakeDocumentFragment";
      }
      if (typeof prop === "string") {
        return createUnsupportedDOMMethod(`DocumentFragment.${prop}`);
      }
      return undefined;
    },
  });
}

/**
 * @param {string} operation
 * @returns {(...args: unknown[]) => never}
 */
function createUnsupportedDOMMethod(operation) {
  return () => {
    throw createUnsupportedDOMError(operation);
  };
}

/**
 * @param {string} operation
 * @returns {Error}
 */
function createUnsupportedDOMError(operation) {
  return new Error(
    `Unsupported DOM operation in Node test harness: ${operation}. ` +
      `Move this test to tests/browser or refactor the module to avoid browser-only behavior in Node.`,
  );
}
