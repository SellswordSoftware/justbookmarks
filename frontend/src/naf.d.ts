// NAF runtime types - exportable from naf.d.ts
// Mirrors the JSDoc typedefs in shared/runtime/naf.js

export interface Component<T extends Element = Element> {
  html: string;
  el?: T;
  refs: Record<string, Element>;
  mount: (parent: Element) => void;
  unmount?: () => void;
}

export type Signal<T> = () => T;

export type Computed<T> = Signal<T>;

export type Effect = () => void;

export type Subs = (() => void)[];

// Tagged template literal function that returns a Component.
export type TemplateTag = (
  strings: TemplateStringsArray,
  ...values: Array<
    string | number | boolean | null | undefined | Component | { __raw: true; html: string }
  >
) => Component<HTMLElement>;
