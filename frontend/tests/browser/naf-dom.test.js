// @ts-check

/**
 * Browser tests for NAF DOM-specific functions.
 *
 * These tests require a real DOM and cannot run in Node.
 * Run via: cd frontend && npm run dev, then open http://localhost:5173/#test
 */

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual, throws } from "../lib/assert.js";
import {
  signal,
  computed,
  effect,
  template,
  mount,
  list,
  fx,
  attr,
  setText,
  show,
  hide,
  requireRef,
  requireElement,
  cleanupCollector,
  collectRowRefs,
  listener,
  model,
  when,
  text,
  raw,
  $,
  $$,
} from "../../src/shared/runtime/naf.js";

/**
 * Create a detached host element for testing.
 * @returns {HTMLElement}
 */
function createHost() {
  return document.createElement("div");
}

describe("template", () => {
  test("creates component with correct HTML structure", () => {
    const comp = template`<div class="test">Hello</div>`;
    strictEqual(typeof comp.html, "string");
    ok(comp.html.includes('<div class="test">Hello</div>'));
    deepEqual(comp.refs, {});
  });

  test("creates component with nested elements", () => {
    const comp = template`<div><span class="inner">Text</span></div>`;
    ok(comp.html.includes('class="inner"'));
    ok(comp.html.includes("Text"));
  });

  test("escapes interpolated values", () => {
    const dangerous = "<script>alert('xss')</script>";
    const comp = template`<div>${dangerous}</div>`;
    ok(comp.html.includes("&lt;script&gt;"));
    ok(!comp.html.includes("<script>"));
  });

  test("supports raw HTML injection", () => {
    const html = "<span class='raw'>Raw</span>";
    const comp = template`<div>${raw(html)}</div>`;
    // raw() inserts the string as-is (single quotes preserved)
    ok(comp.html.includes("class='raw'"));
    ok(comp.html.includes("Raw"));
  });

  test("skips null/undefined/false values", () => {
    const comp = template`<div>${null} ${undefined} ${false}</div>`;
    ok(!comp.html.includes("null"));
    ok(!comp.html.includes("undefined"));
    ok(!comp.html.includes("false"));
  });

  test("renders number values", () => {
    const comp = template`<div>Count: ${42}</div>`;
    ok(comp.html.includes("Count: 42"));
  });

  test("extracts refs from data-ref attributes", () => {
    const comp = template`<div><span data-ref="label"></span><button data-ref="btn"></button></div>`;
    // refs are populated on mount, not at template creation time
    strictEqual(Object.keys(comp.refs).length, 0);
  });

  test("supports component nesting", () => {
    const child = template`<span class="child">Child</span>`;
    const parent = template`<div class="parent">${child}</div>`;
    ok(parent.html.includes("parent"));
    // Nested components become slot markers, not inlined HTML
    ok(parent.html.includes("data-naf-component-slot"));
  });

  test("supports options with root selector", () => {
    const comp = template({ root: ".root-el" })`<div class="root-el"><span></span></div>`;
    strictEqual(typeof comp.html, "string");
    ok(comp.html.includes("root-el"));
  });
});

describe("mount", () => {
  test("appends component to host element", () => {
    const host = createHost();
    const comp = template`<div class="mounted">Content</div>`;
    mount(comp, host);
    strictEqual(host.children.length, 1);
    strictEqual(host.firstChild?.className, "mounted");
  });

  test("replaces existing host content", () => {
    const host = createHost();
    host.innerHTML = "<div>Old</div>";
    const comp = template`<div class="new">New</div>`;
    mount(comp, host);
    strictEqual(host.children.length, 1);
    strictEqual(host.firstChild?.className, "new");
  });

  test("throws when host is null", () => {
    const comp = template`<div></div>`;
    throws(() => mount(comp, null), "Expected host element");
  });

  test("calls onMount callback with context", () => {
    /** @type {any} */
    let mountCtx = null;
    const comp = template({
      onMount(el, parent, ctx) {
        mountCtx = { el, parent, ctx };
      },
    })`<div data-ref="root">Mount test</div>`;

    const host = createHost();
    mount(comp, host);

    ok(mountCtx !== null);
    ok(mountCtx.ctx);
    ok(mountCtx.ctx.refs);
    ok(mountCtx.ctx.refs.root);
    strictEqual(mountCtx.ctx.host, host);
  });

  test("populates refs from data-ref attributes", () => {
    const comp = template`<div><span data-ref="label"></span><button data-ref="btn"></button></div>`;
    const host = createHost();
    mount(comp, host);

    ok(comp.refs.label instanceof Element);
    ok(comp.refs.btn instanceof Element);
    strictEqual(Object.keys(comp.refs).length, 2);
  });

  test("throws on duplicate data-ref", () => {
    const comp = template`<div><span data-ref="dup"></span><span data-ref="dup"></span></div>`;
    const host = createHost();
    throws(() => mount(comp, host), "Duplicate data-ref");
  });

  test("calls onUnmount callback", () => {
    /** @type {boolean} */
    let unmounted = false;
    const comp = template({
      onUnmount() {
        unmounted = true;
      },
    })`<div>Unmount test</div>`;

    const host = createHost();
    mount(comp, host);
    comp.unmount?.();
    ok(unmounted);
  });

  test("removes DOM elements on unmount", () => {
    const comp = template`<div class="removable">Content</div>`;
    const host = createHost();
    mount(comp, host);
    strictEqual(host.children.length, 1);
    comp.unmount?.();
    strictEqual(host.children.length, 0);
  });
});

describe("list", () => {
  test("renders correct number of rows from items", () => {
    const host = createHost();
    const items = signal([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ]);

    list(
      host,
      '<div class="row"><span data-ref="name"></span></div>',
      items,
      (item) => item.id,
      (el) => {},
    );

    strictEqual(host.children.length, 3);
  });

  test("renders zero rows for empty items", () => {
    const host = createHost();
    const items = signal([]);

    list(
      host,
      '<div class="row"></div>',
      items,
      (item) => item.id,
      (el) => {},
    );

    strictEqual(host.children.length, 0);
  });

  test("calls setup callback for each row", () => {
    const host = createHost();
    const items = signal([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);

    /** @type {string[]} */
    const names = [];
    list(
      host,
      '<div class="row"><span></span></div>',
      items,
      (item) => item.id,
      (el, item) => {
        names.push(item().name);
      },
    );

    deepEqual(names, ["A", "B"]);
  });

  test("setup receives index signal", () => {
    const host = createHost();
    const items = signal([{ id: 1 }, { id: 2 }, { id: 3 }]);

    /** @type {number[]} */
    const indices = [];
    list(
      host,
      '<div class="row"></div>',
      items,
      (item) => item.id,
      (_el, _item, index) => {
        indices.push(index());
      },
    );

    deepEqual(indices, [0, 1, 2]);
  });

  test("adds rows when items grow", () => {
    const host = createHost();
    const items = signal([{ id: 1 }]);

    list(
      host,
      '<div class="row"></div>',
      items,
      (item) => item.id,
      (el) => {},
    );

    strictEqual(host.children.length, 1);
    items([{ id: 1 }, { id: 2 }]);
    strictEqual(host.children.length, 2);
  });

  test("removes rows when items shrink", () => {
    const host = createHost();
    const items = signal([{ id: 1 }, { id: 2 }, { id: 3 }]);

    list(
      host,
      '<div class="row"></div>',
      items,
      (item) => item.id,
      (el) => {},
    );

    strictEqual(host.children.length, 3);
    items([{ id: 1 }]);
    strictEqual(host.children.length, 1);
  });

  test("supports HTMLTemplateElement", () => {
    const host = createHost();
    const tpl = document.createElement("template");
    tpl.innerHTML = '<div class="tpl-row"></div>';

    const items = signal([{ id: 1 }]);
    list(
      host,
      tpl,
      items,
      (item) => item.id,
      (el) => {},
    );

    strictEqual(host.children.length, 1);
    strictEqual(host.firstChild?.className, "tpl-row");
  });

  test("returns cleanup function", () => {
    const host = createHost();
    const items = signal([{ id: 1 }]);

    const cleanup = list(
      host,
      '<div class="row"></div>',
      items,
      (item) => item.id,
      (el) => {},
    );

    strictEqual(host.children.length, 1);
    cleanup();
    strictEqual(host.children.length, 0);
  });

  test("returns no-op when container is null", () => {
    const cleanup = list(
      null,
      '<div></div>',
      () => [],
      () => 0,
      () => {},
    );
    cleanup(); // should not throw
  });

  test("returns no-op when template is null", () => {
    const host = createHost();
    const cleanup = list(
      host,
      null,
      () => [],
      () => 0,
      () => {},
    );
    cleanup(); // should not throw
  });
});

describe("fx", () => {
  test("sets up effect that updates on signal change", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("initial");
    fx(el, (e) => {
      e.textContent = s();
    });

    strictEqual(el.textContent, "initial");
    s("updated");
    strictEqual(el.textContent, "updated");
  });

  test("returns cleanup function", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("initial");
    const cleanup = fx(el, (e) => {
      e.textContent = s();
    });

    s("before-cleanup");
    strictEqual(el.textContent, "before-cleanup");
    cleanup();
    s("after-cleanup");
    strictEqual(el.textContent, "before-cleanup");
  });

  test("returns no-op when element is null", () => {
    const cleanup = fx(null, () => {});
    cleanup(); // should not throw
  });
});

describe("attr", () => {
  test("sets attribute on element", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("test-value");
    attr(el, "data-test", s);

    strictEqual(el.getAttribute("data-test"), "test-value");
  });

  test("updates attribute on signal change", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("initial");
    attr(el, "data-val", s);

    strictEqual(el.getAttribute("data-val"), "initial");
    s("updated");
    strictEqual(el.getAttribute("data-val"), "updated");
  });

  test("removes attribute when value is null", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("value");
    attr(el, "data-removable", s);
    strictEqual(el.getAttribute("data-removable"), "value");

    s(null);
    ok(el.getAttribute("data-removable") === null);
  });

  test("removes attribute when value is false", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("value");
    attr(el, "data-bool", s);
    s(false);
    ok(el.getAttribute("data-bool") === null);
  });

  test("sets boolean attribute when value is true", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal(false);
    attr(el, "data-disabled", s);
    ok(el.getAttribute("data-disabled") === null);

    s(true);
    strictEqual(el.getAttribute("data-disabled"), "");
  });

  test("returns cleanup function", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("initial");
    const cleanup = attr(el, "data-cleanup", s);

    s("before-cleanup");
    strictEqual(el.getAttribute("data-cleanup"), "before-cleanup");
    cleanup();
    s("after-cleanup");
    strictEqual(el.getAttribute("data-cleanup"), "before-cleanup");
  });

  test("returns no-op when element is null", () => {
    const cleanup = attr(null, "test", () => "value");
    cleanup(); // should not throw
  });
});

describe("setText", () => {
  test("sets textContent on element", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("Hello World");
    setText(el, s);

    strictEqual(el.textContent, "Hello World");
  });

  test("updates textContent on signal change", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("initial");
    setText(el, s);

    strictEqual(el.textContent, "initial");
    s("updated");
    strictEqual(el.textContent, "updated");
  });

  test("converts non-string values to string", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal(42);
    setText(el, s);

    strictEqual(el.textContent, "42");
  });

  test("returns cleanup function", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal("initial");
    const cleanup = setText(el, s);

    s("before-cleanup");
    strictEqual(el.textContent, "before-cleanup");
    cleanup();
    s("after-cleanup");
    strictEqual(el.textContent, "before-cleanup");
  });

  test("returns no-op when element is null", () => {
    const cleanup = setText(null, () => "value");
    cleanup(); // should not throw
  });
});

describe("show", () => {
  test("shows element when condition is truthy", () => {
    const host = createHost();
    const el = document.createElement("div");
    el.hidden = true;
    host.appendChild(el);

    const s = signal(true);
    show(el, s);

    ok(!el.hidden);
  });

  test("hides element when condition is falsy", () => {
    const host = createHost();
    const el = document.createElement("div");
    el.hidden = false;
    host.appendChild(el);

    const s = signal(false);
    show(el, s);

    ok(el.hidden);
  });

  test("toggles on signal change", () => {
    const host = createHost();
    const el = document.createElement("div");
    host.appendChild(el);

    const s = signal(false);
    show(el, s);
    ok(el.hidden);

    s(true);
    ok(!el.hidden);

    s(false);
    ok(el.hidden);
  });

  test("returns no-op when element is null", () => {
    const cleanup = show(null, () => true);
    cleanup(); // should not throw
  });
});

describe("hide", () => {
  test("hides element when condition is truthy", () => {
    const host = createHost();
    const el = document.createElement("div");
    el.hidden = false;
    host.appendChild(el);

    const s = signal(true);
    hide(el, s);

    ok(el.hidden);
  });

  test("shows element when condition is falsy", () => {
    const host = createHost();
    const el = document.createElement("div");
    el.hidden = true;
    host.appendChild(el);

    const s = signal(false);
    hide(el, s);

    ok(!el.hidden);
  });

  test("returns no-op when element is null", () => {
    const cleanup = hide(null, () => true);
    cleanup(); // should not throw
  });
});

describe("requireRef", () => {
  test("returns ref by name", () => {
    const el = document.createElement("span");
    const refs = { label: el };
    const result = /** @type {HTMLElement} */ (requireRef(refs, "label"));
    strictEqual(result, el);
  });

  test("throws when ref is missing", () => {
    const refs = { label: document.createElement("span") };
    throws(() => requireRef(refs, "missing"), "Missing required ref: missing");
  });
});

describe("requireElement", () => {
  test("returns element when found", () => {
    const host = createHost();
    host.innerHTML = '<div id="target">Found</div>';
    const result = /** @type {HTMLElement} */ (requireElement(host, "#target", "target"));
    strictEqual(result.id, "target");
  });

  test("throws when element not found", () => {
    const host = createHost();
    throws(() => requireElement(host, "#missing", "missing"), "Missing required element");
  });
});

describe("cleanupCollector", () => {
  test("collects initial cleanups", () => {
    /** @type {boolean} */
    let ran = false;
    const collector = cleanupCollector(() => { ran = true; });
    collector.run();
    ok(ran);
  });

  test("adds more cleanups", () => {
    /** @type {string[]} */
    const order = [];
    const collector = cleanupCollector(() => order.push("a"));
    collector.add(() => order.push("b"));
    collector.add(() => order.push("c"));
    collector.run();
    // Cleanups run in reverse order (LIFO)
    deepEqual(order, ["c", "b", "a"]);
  });

  test("skips null/undefined/false cleanups", () => {
    const collector = cleanupCollector(() => {});
    collector.add(null);
    collector.add(undefined);
    collector.add(false);
    collector.run(); // should not throw
  });

  test("can be run multiple times safely", () => {
    /** @type {number} */
    let count = 0;
    const collector = cleanupCollector(() => count++);
    collector.run();
    strictEqual(count, 1);
    collector.run();
    strictEqual(count, 1); // already cleared
  });
});

describe("collectRowRefs", () => {
  test("collects refs from row element", () => {
    const row = document.createElement("div");
    row.innerHTML = '<span data-ref="label"></span><button data-ref="btn"></button>';
    const refs = collectRowRefs(row);

    ok(refs.label instanceof Element);
    ok(refs.btn instanceof Element);
    strictEqual(Object.keys(refs).length, 2);
  });

  test("includes row element itself if it has data-ref", () => {
    const row = document.createElement("div");
    row.setAttribute("data-ref", "row");
    row.innerHTML = '<span data-ref="inner"></span>';
    const refs = collectRowRefs(row);

    ok(refs.row instanceof Element);
    ok(refs.inner instanceof Element);
    strictEqual(Object.keys(refs).length, 2);
  });

  test("returns empty object when no refs", () => {
    const row = document.createElement("div");
    row.innerHTML = "<span>No refs here</span>";
    const refs = collectRowRefs(row);
    strictEqual(Object.keys(refs).length, 0);
  });
});

describe("listener", () => {
  test("attaches and removes event listener", () => {
    const host = createHost();
    const btn = document.createElement("button");
    host.appendChild(btn);

    /** @type {boolean} */
    let clicked = false;
    const handler = () => { clicked = true; };

    const cleanup = listener(btn, "click", handler);
    btn.click();
    ok(clicked);

    clicked = false;
    cleanup();
    btn.click();
    ok(!clicked);
  });

  test("handles null element gracefully", () => {
    const cleanup = listener(null, "click", () => {});
    cleanup(); // should not throw
  });
});

describe("model", () => {
  test("binds input value to signal", () => {
    const host = createHost();
    const input = document.createElement("input");
    host.appendChild(input);

    const s = signal("initial");
    const { cleanup } = model(input, s);

    strictEqual(input.value, "initial");

    // Simulate user input
    input.value = "changed";
    input.dispatchEvent(new Event("input"));
    strictEqual(s(), "changed");

    cleanup();
  });

  test("binds checkbox checked to signal", () => {
    const host = createHost();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    host.appendChild(checkbox);

    const s = signal(true);
    const { cleanup } = model(checkbox, s);

    ok(checkbox.checked);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    ok(!s());

    cleanup();
  });

  test("returns null el when input is null", () => {
    const s = signal("test");
    const { el, cleanup } = model(null, s);
    strictEqual(el, null);
    cleanup(); // should not throw
  });
});

describe("when", () => {
  test("renders then-branch when condition is truthy", () => {
    const host = createHost();
    const s = signal(true);

    const comp = when(
      s,
      () => template`<div class="then">Then</div>`,
      () => template`<div class="else">Else</div>`,
    );

    comp.mount(host);
    ok(host.querySelector(".then"));
    ok(!host.querySelector(".else"));
  });

  test("renders else-branch when condition is falsy", () => {
    const host = createHost();
    const s = signal(false);

    const comp = when(
      s,
      () => template`<div class="then">Then</div>`,
      () => template`<div class="else">Else</div>`,
    );

    comp.mount(host);
    ok(!host.querySelector(".then"));
    ok(host.querySelector(".else"));
  });

  test("switches branches on condition change", () => {
    const host = createHost();
    const s = signal(true);

    const comp = when(
      s,
      () => template`<div class="then">Then</div>`,
      () => template`<div class="else">Else</div>`,
    );

    comp.mount(host);
    ok(host.querySelector(".then"));

    s(false);
    ok(!host.querySelector(".then"));
    ok(host.querySelector(".else"));
  });

  test("unmounts current branch", () => {
    const host = createHost();
    /** @type {boolean} */
    let thenUnmounted = false;
    const s = signal(true);

    const comp = when(
      s,
      () => template({
        onUnmount() { thenUnmounted = true; },
      })`<div class="then">Then</div>`,
      () => template`<div class="else">Else</div>`,
    );

    comp.mount(host);
    s(false);
    ok(thenUnmounted);
  });
});

describe("text", () => {
  test("escapes ampersands", () => {
    strictEqual(text("A & B"), "A &amp; B");
  });

  test("escapes less-than and greater-than", () => {
    strictEqual(text("<div>"), "&lt;div&gt;");
  });

  test("escapes quotes", () => {
    strictEqual(text('"hello"'), "&quot;hello&quot;");
  });

  test("escapes single quotes", () => {
    strictEqual(text("it's"), "it&#39;s");
  });

  test("leaves safe characters unchanged", () => {
    strictEqual(text("Hello World 123"), "Hello World 123");
  });
});

describe("$", () => {
  test("finds single element", () => {
    const host = createHost();
    host.innerHTML = '<div id="target">Found</div>';
    const result = $("#target", host);
    ok(result);
    strictEqual(result.id, "target");
  });

  test("returns null when not found", () => {
    const host = createHost();
    const result = $("#missing", host);
    strictEqual(result, null);
  });
});

describe("$$", () => {
  test("finds multiple elements", () => {
    const host = createHost();
    host.innerHTML = '<div class="item">1</div><div class="item">2</div><div class="item">3</div>';
    const results = $$(".item", host);
    strictEqual(results.length, 3);
  });

  test("returns empty array when none found", () => {
    const host = createHost();
    const results = $$(".missing", host);
    strictEqual(results.length, 0);
  });
});
