// Debug script for untrack behavior
globalThis.document = {
  createElement: () => ({
    style: {},
    setAttribute: () => {},
    removeAttribute: () => {},
    appendChild: () => {},
    childNodes: [],
    children: [],
    textContent: '',
    innerHTML: '',
    className: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    focus: () => {},
    blur: () => {},
    click: () => {},
    dispatchEvent: () => true,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    getAttribute: () => null,
    hasAttribute: () => false,
  }),
  createTextNode: () => ({ nodeValue: '', textContent: '' }),
  createDocumentFragment: () => ({ appendChild: () => {}, childNodes: [] }),
};

import { signal, computed, untrack } from "../src/shared/runtime/naf.js";

const s = signal(1);
const t = signal(10);
let computeCount = 0;
const c = computed(() => {
  computeCount++;
  const untracked = untrack(() => s());
  return t() + untracked;
});

console.log("Initial c():", c(), "computeCount:", computeCount);
s(5);
console.log("After s(5): computeCount:", computeCount);
t(20);
console.log("After t(20): computeCount:", computeCount);
console.log("c() after t:", c());
