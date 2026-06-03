// @ts-check

/**
 * Browser tests for NAF component rendering behavior.
 *
 * Focuses on:
 * - Components mount and render expected DOM structure
 * - Signal-driven updates reflect in DOM
 * - Data-ref elements are accessible via ctx.refs
 * - Component lifecycle (mount/unmount)
 * - Component nesting and slot resolution
 * - Component cleanup
 *
 * Run via: cd frontend && npm run dev, then open http://localhost:5173/#test
 */

import { describe, test } from "../lib/test.js";
import { ok, strictEqual, deepEqual } from "../lib/assert.js";
import {
  signal,
  computed,
  template,
  mount,
  list,
  fx,
  attr,
  setText,
  show,
  hide,
  cleanupCollector,
  collectRowRefs,
  when,
} from "../../src/shared/runtime/naf.js";

/**
 * Create a detached host element for testing.
 * @returns {HTMLElement}
 */
function createHost() {
  return document.createElement("div");
}

describe("component rendering", () => {
  test("mounts and renders expected DOM structure", () => {
    const host = createHost();
    const comp = template`<div class="container"><h1>Title</h1><p>Body</p></div>`;
    mount(comp, host);

    ok(host.querySelector(".container"));
    ok(host.querySelector("h1"));
    ok(host.querySelector("p"));
    strictEqual(host.querySelector("h1")?.textContent, "Title");
    strictEqual(host.querySelector("p")?.textContent, "Body");
  });

  test("renders nested elements with correct hierarchy", () => {
    const host = createHost();
    const comp = template`<div><ul><li class="item">A</li><li class="item">B</li></ul></div>`;
    mount(comp, host);

    const items = host.querySelectorAll(".item");
    strictEqual(items.length, 2);
    strictEqual(items[0].textContent, "A");
    strictEqual(items[1].textContent, "B");
  });

  test("renders multiple root elements", () => {
    const host = createHost();
    const comp = template`<div>First</div><span>Second</span>`;
    mount(comp, host);

    strictEqual(host.children.length, 2);
    strictEqual(host.children[0].textContent, "First");
    strictEqual(host.children[1].textContent, "Second");
  });
});

describe("component signal-driven updates", () => {
  test("fx updates DOM on signal change", () => {
    const host = createHost();
    const count = signal(0);

    const comp = template({
      onMount(_el, _parent, ctx) {
        const label = ctx.refs.label;
        fx(label, (el) => {
          el.textContent = `Count: ${count()}`;
        });
      },
    })`<div><span data-ref="label"></span></div>`;

    mount(comp, host);
    strictEqual(host.querySelector("[data-ref='label']")?.textContent, "Count: 0");

    count(5);
    strictEqual(host.querySelector("[data-ref='label']")?.textContent, "Count: 5");
  });

  test("setText updates DOM on signal change", () => {
    const host = createHost();
    const name = signal("Alice");

    const comp = template({
      onMount(_el, _parent, ctx) {
        setText(ctx.refs.greeting, name);
      },
    })`<div><span data-ref="greeting"></span></div>`;

    mount(comp, host);
    strictEqual(host.querySelector("[data-ref='greeting']")?.textContent, "Alice");

    name("Bob");
    strictEqual(host.querySelector("[data-ref='greeting']")?.textContent, "Bob");
  });

  test("attr updates attribute on signal change", () => {
    const host = createHost();
    const disabled = signal(false);

    const comp = template({
      onMount(_el, _parent, ctx) {
        attr(ctx.refs.btn, "disabled", disabled);
      },
    })`<div><button data-ref="btn">Click</button></div>`;

    mount(comp, host);
    ok(!host.querySelector("[data-ref='btn']")?.hasAttribute("disabled"));

    disabled(true);
    ok(host.querySelector("[data-ref='btn']")?.hasAttribute("disabled"));

    disabled(false);
    ok(!host.querySelector("[data-ref='btn']")?.hasAttribute("disabled"));
  });

  test("show/hide toggles visibility on signal change", () => {
    const host = createHost();
    const visible = signal(true);

    const comp = template({
      onMount(_el, _parent, ctx) {
        show(ctx.refs.panel, visible);
      },
    })`<div><div data-ref="panel" class="panel">Content</div></div>`;

    mount(comp, host);
    ok(!host.querySelector(".panel")?.hidden);

    visible(false);
    ok(host.querySelector(".panel")?.hidden);

    visible(true);
    ok(!host.querySelector(".panel")?.hidden);
  });

  test("computed signal drives DOM updates", () => {
    const host = createHost();
    const firstName = signal("John");
    const lastName = signal("Doe");
    const fullName = computed(() => `${firstName()} ${lastName()}`);

    const comp = template({
      onMount(_el, _parent, ctx) {
        setText(ctx.refs.name, fullName);
      },
    })`<div><span data-ref="name"></span></div>`;

    mount(comp, host);
    strictEqual(host.querySelector("[data-ref='name']")?.textContent, "John Doe");

    firstName("Jane");
    strictEqual(host.querySelector("[data-ref='name']")?.textContent, "Jane Doe");

    lastName("Smith");
    strictEqual(host.querySelector("[data-ref='name']")?.textContent, "Jane Smith");
  });
});

describe("component refs", () => {
  test("ctx.refs contains data-ref elements", () => {
    /** @type {Record<string, Element> | undefined} */
    let refs;

    const comp = template({
      onMount(_el, _parent, ctx) {
        refs = ctx.refs;
      },
    })`<div><span data-ref="label"></span><button data-ref="btn"></button><input data-ref="input"></div>`;

    const host = createHost();
    mount(comp, host);

    ok(refs);
    ok(refs?.label instanceof Element);
    ok(refs?.btn instanceof Element);
    ok(refs?.input instanceof Element);
    strictEqual(Object.keys(refs).length, 3);
  });

  test("refs are accessible after mount via component.refs", () => {
    const comp = template`<div><span data-ref="title"></span></div>`;
    const host = createHost();
    mount(comp, host);

    ok(comp.refs.title instanceof Element);
    strictEqual(comp.refs.title.textContent, "");
  });

  test("refs are cleared on unmount", () => {
    const comp = template`<div><span data-ref="title"></span></div>`;
    const host = createHost();
    mount(comp, host);

    ok(comp.refs.title instanceof Element);
    comp.unmount?.();
    strictEqual(Object.keys(comp.refs).length, 0);
  });

  test("root selector finds element and sets component.el", () => {
    /** @type {Element | undefined} */
    let foundRoot;

    const comp = template({
      root: ".main",
      onMount(el) {
        foundRoot = el;
      },
    })`<div class="wrapper"><div class="main"><span data-ref="inner"></span></div></div>`;

    const host = createHost();
    mount(comp, host);

    ok(foundRoot);
    strictEqual(foundRoot?.className, "main");
    ok(comp.refs.inner instanceof Element);
  });
});

describe("component lifecycle", () => {
  test("onMount receives correct context", () => {
    /** @type {any} */
    let ctx;

    const comp = template({
      onMount(_el, _parent, c) {
        ctx = c;
      },
    })`<div></div>`;

    const host = createHost();
    mount(comp, host);

    ok(ctx);
    strictEqual(ctx.host, host);
    ok(ctx.refs instanceof Object);
    ok(ctx.cleanup);
    ok(ctx.component);
  });

  test("onUnmount is called on unmount", () => {
    /** @type {boolean} */
    let unmounted = false;

    const comp = template({
      onUnmount() {
        unmounted = true;
      },
    })`<div>Content</div>`;

    const host = createHost();
    mount(comp, host);
    ok(!unmounted);

    comp.unmount?.();
    ok(unmounted);
  });

  test("onUnmount receives context", () => {
    /** @type {any} */
    let unmountCtx;

    const comp = template({
      onUnmount(c) {
        unmountCtx = c;
      },
    })`<div></div>`;

    const host = createHost();
    mount(comp, host);
    comp.unmount?.();

    ok(unmountCtx);
    ok(unmountCtx.refs);
    ok(unmountCtx.cleanup);
  });

  test("cleanup collector runs on unmount", () => {
    /** @type {boolean} */
    let cleaned = false;

    const comp = template({
      onMount(_el, _parent, ctx) {
        ctx.cleanup.add(() => { cleaned = true; });
      },
    })`<div></div>`;

    const host = createHost();
    mount(comp, host);
    ok(!cleaned);

    comp.unmount?.();
    ok(cleaned);
  });

  test("fx cleanup runs on unmount", () => {
    const host = createHost();
    const s = signal(0);

    const comp = template({
      onMount(_el, _parent, ctx) {
        fx(ctx.refs.label, (el) => {
          el.textContent = s();
        });
      },
    })`<div><span data-ref="label"></span></div>`;

    mount(comp, host);
    s(1);
    strictEqual(host.querySelector("[data-ref='label']")?.textContent, "1");

    comp.unmount?.();
    s(2);
    // After unmount, fx should be cleaned up
    strictEqual(host.querySelector("[data-ref='label']")?.textContent, "1");
  });

  test("DOM is removed on unmount", () => {
    const comp = template`<div class="removable">Content</div>`;
    const host = createHost();
    mount(comp, host);

    strictEqual(host.children.length, 1);
    comp.unmount?.();
    strictEqual(host.children.length, 0);
  });

  test("multiple cleanups run in reverse order", () => {
    /** @type {string[]} */
    const order = [];

    const comp = template({
      onMount(_el, _parent, ctx) {
        ctx.cleanup.add(() => order.push("a"));
        ctx.cleanup.add(() => order.push("b"));
        ctx.cleanup.add(() => order.push("c"));
      },
    })`<div></div>`;

    const host = createHost();
    mount(comp, host);
    comp.unmount?.();

    deepEqual(order, ["c", "b", "a"]);
  });
});

describe("component nesting", () => {
  test("nested components mount into slot hosts", () => {
    const child = template`<span class="child">Child</span>`;
    const parent = template`<div class="parent">${child}</div>`;

    const host = createHost();
    mount(parent, host);

    ok(host.querySelector(".parent"));
    ok(host.querySelector(".child"));
    strictEqual(host.querySelector(".child")?.textContent, "Child");
  });

  test("nested component unmounts when parent unmounts", () => {
    /** @type {boolean} */
    let childUnmounted = false;

    const child = template({
      onUnmount() {
        childUnmounted = true;
      },
    })`<span class="child">Child</span>`;

    const parent = template`<div class="parent">${child}</div>`;

    const host = createHost();
    mount(parent, host);
    ok(!childUnmounted);

    parent.unmount?.();
    ok(childUnmounted);
  });

  test("multiple nested components mount correctly", () => {
    const a = template`<span class="a">A</span>`;
    const b = template`<span class="b">B</span>`;
    const parent = template`<div>${a} middle ${b}</div>`;

    const host = createHost();
    mount(parent, host);

    ok(host.querySelector(".a"));
    ok(host.querySelector(".b"));
    strictEqual(host.querySelector(".a")?.textContent, "A");
    strictEqual(host.querySelector(".b")?.textContent, "B");
  });
});

describe("component with list", () => {
  test("list renders inside component onMount", () => {
    const items = signal([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);

    const comp = template({
      onMount(_el, _parent, ctx) {
        list(
          ctx.refs.list,
          '<li data-ref="item"><span data-ref="name"></span></li>',
          items,
          (item) => item.id,
          (el) => {
            const refs = collectRowRefs(el);
            refs.name.textContent = item().name;
          },
        );
      },
    })`<div><ul data-ref="list"></ul></div>`;

    const host = createHost();
    mount(comp, host);

    const lis = host.querySelectorAll("li");
    strictEqual(lis.length, 2);
  });

  test("list updates when items change", () => {
    const items = signal([{ id: 1 }]);

    const comp = template({
      onMount(_el, _parent, ctx) {
        list(
          ctx.refs.list,
          '<li></li>',
          items,
          (item) => item.id,
          () => {},
        );
      },
    })`<div><div data-ref="list"></div></div>`;

    const host = createHost();
    mount(comp, host);

    strictEqual(host.querySelectorAll("li").length, 1);
    items([{ id: 1 }, { id: 2 }, { id: 3 }]);
    strictEqual(host.querySelectorAll("li").length, 3);
  });
});

describe("component with when", () => {
  test("when renders correct branch inside component", () => {
    const loading = signal(true);

    const comp = template({
      onMount(_el, _parent, ctx) {
        mount(
          when(
            loading,
            () => template`<div class="spinner">Loading...</div>`,
            () => template`<div class="content">Done</div>`,
          ),
          ctx.refs.area,
        );
      },
    })`<div><div data-ref="area"></div></div>`;

    const host = createHost();
    mount(comp, host);

    ok(host.querySelector(".spinner"));
    ok(!host.querySelector(".content"));

    loading(false);
    ok(!host.querySelector(".spinner"));
    ok(host.querySelector(".content"));
  });
});

describe("component mount/unmount idempotency", () => {
  test("mount replaces existing host content", () => {
    const host = createHost();
    host.innerHTML = "<div>Old content</div>";

    const comp = template`<div class="new">New</div>`;
    mount(comp, host);

    strictEqual(host.children.length, 1);
    strictEqual(host.firstChild?.className, "new");
    ok(!host.querySelector("[class='']"));
  });

  test("unmount on already unmounted component is safe", () => {
    const comp = template`<div></div>`;
    const host = createHost();
    mount(comp, host);
    comp.unmount?.();
    comp.unmount?.(); // should not throw
  });
});
