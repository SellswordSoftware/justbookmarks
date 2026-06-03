// @ts-check

import { describe, test } from "../lib/test.js";
import { ok, equal, strictEqual, deepEqual, notOk } from "../lib/assert.js";
import { signal, computed, effect, untrack } from "../../src/shared/runtime/naf.js";

describe("signal", () => {
  test("returns initial value", () => {
    const s = signal(42);
    strictEqual(s(), 42);
  });

  test("updates on set", () => {
    const s = signal(42);
    strictEqual(s(100), 100);
    strictEqual(s(), 100);
  });

  test("returns new value on set", () => {
    const s = signal("a");
    strictEqual(s("b"), "b");
  });

  test("does not notify when set to same value", () => {
    const s = signal(42);
    let effectCount = 0;
    effect(() => {
      effectCount++;
      s();
    });
    s(42);
    strictEqual(effectCount, 1);
  });

  test("works with object values", () => {
    const s = signal({ count: 0 });
    const obj = { count: 1 };
    s(obj);
    strictEqual(s().count, 1);
  });

  test("works with array values", () => {
    const s = signal([]);
    s([1, 2, 3]);
    deepEqual(s(), [1, 2, 3]);
  });

  test("notifies computed on change", () => {
    const s = signal(1);
    const c = computed(() => s() * 2);
    strictEqual(c(), 2);
    s(5);
    strictEqual(c(), 10);
  });

  test("notifies effect on change", () => {
    const s = signal(0);
    const calls = [];
    effect(() => {
      calls.push(s());
    });
    deepEqual(calls, [0]);
    s(1);
    s(2);
    deepEqual(calls, [0, 1, 2]);
  });
});

describe("computed", () => {
  test("computes lazily", () => {
    let computeCount = 0;
    const s = signal(1);
    const c = computed(() => {
      computeCount++;
      return s() * 2;
    });

    strictEqual(computeCount, 0);
    strictEqual(c(), 2);
    strictEqual(computeCount, 1);
  });

  test("caches result", () => {
    let computeCount = 0;
    const s = signal(1);
    const c = computed(() => {
      computeCount++;
      return s() * 2;
    });

    c();
    c();
    c();
    strictEqual(computeCount, 1);
  });

  test("invalidates on dependency change", () => {
    let computeCount = 0;
    const s = signal(1);
    const c = computed(() => {
      computeCount++;
      return s() * 2;
    });

    c();
    strictEqual(c(), 2);
    s(5);
    strictEqual(c(), 10);
    strictEqual(computeCount, 2);
  });

  test("notifies subscribers when invalidated", () => {
    const s = signal(1);
    const c = computed(() => s() * 2);
    const calls = [];
    effect(() => {
      calls.push(c());
    });

    deepEqual(calls, [2]);
    s(5);
    deepEqual(calls, [2, 10]);
  });

  test("supports multiple dependencies", () => {
    const a = signal(10);
    const b = signal(20);
    const c = computed(() => a() + b());

    strictEqual(c(), 30);
    a(100);
    strictEqual(c(), 120);
    b(200);
    strictEqual(c(), 300);
  });

  test("chains computed values", () => {
    const s = signal(1);
    const doubled = computed(() => s() * 2);
    const tripled = computed(() => doubled() * 3);

    strictEqual(tripled(), 6);
    s(5);
    strictEqual(tripled(), 30);
  });
});

describe("effect", () => {
  test("runs immediately", () => {
    const s = signal(0);
    const calls = [];
    effect(() => {
      calls.push(s());
    });
    deepEqual(calls, [0]);
  });

  test("re-runs on dependency change", () => {
    const s = signal(0);
    const calls = [];
    effect(() => {
      calls.push(s());
    });
    s(1);
    s(2);
    deepEqual(calls, [0, 1, 2]);
  });

  test("dispose unsubscribes", () => {
    const s = signal(0);
    const calls = [];
    const dispose = effect(() => {
      calls.push(s());
    });
    s(1);
    dispose();
    s(2);
    deepEqual(calls, [0, 1]);
  });

  test("does not re-run after dispose", () => {
    const s = signal(0);
    const calls = [];
    const dispose = effect(() => {
      calls.push(s());
    });
    dispose();
    s(1);
    s(2);
    deepEqual(calls, [0]);
  });

  test("supports multiple dependencies", () => {
    const a = signal(0);
    const b = signal(0);
    const calls = [];
    effect(() => {
      calls.push(`${a()}-${b()}`);
    });
    a(1);
    b(1);
    deepEqual(calls, ["0-0", "1-0", "1-1"]);
  });

  test("does not run twice for same value", () => {
    const s = signal(0);
    const calls = [];
    effect(() => {
      calls.push(s());
    });
    s(0);
    deepEqual(calls, [0]);
  });
});

describe("untrack", () => {
  test("reads signal without tracking dependency", () => {
    const s = signal(1);
    let computeCount = 0;
    const c = computed(() => {
      computeCount++;
      return untrack(() => s()) * 2;
    });

    c();
    s(5);
    strictEqual(computeCount, 1);
  });

  test("returns function result", () => {
    const s = signal(42);
    const result = untrack(() => s() + 1);
    strictEqual(result, 43);
  });

  test("prevents effect from re-running", () => {
    const s = signal(0);
    const calls = [];
    effect(() => {
      calls.push(untrack(() => s()));
    });
    s(1);
    s(2);
    deepEqual(calls, [0]);
  });

  test.skip("does not affect outer tracking", () => {
    const s = signal(1);
    const t = signal(10);
    let computeCount = 0;
    const c = computed(() => {
      computeCount++;
      const untracked = untrack(() => s());
      return t() + untracked;
    });

    strictEqual(c(), 11);
    s(5);
    // s(5) should NOT invalidate c -- untrack prevents tracking s
    strictEqual(computeCount, 1);
    t(20);
    // t(20) SHOULD invalidate c
    strictEqual(computeCount, 2);
    // Verify the computed value reflects the updated t but old s
    strictEqual(c(), 21);
  });
});
