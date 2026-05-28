Yes — you can build a **small DaisyUI-like system without Tailwind/DaisyUI** by copying the *architecture*, not the dependency.

DaisyUI’s core idea is simple: **semantic component classes + theme variables**. It uses theme names via `data-theme`, e.g. `<html data-theme="cupcake">`, and swaps design tokens like primary, secondary, base, accent, etc. DaisyUI currently ships many built-in themes and supports custom themes this way. ([DaisyUI][1]) Tailwind v4 also leans hard into CSS variables as design tokens, which validates the same general direction, but you do not need Tailwind to use that approach. ([Tailwind CSS][2])

## The approach I’d use

Create your own tiny CSS design system with three layers:

```text
tokens.css       // colors, radius, shadows, spacing, typography
base.css         // body, headings, links, forms, focus rings
components.css   // .btn, .card, .input, .alert, .modal, etc.
```

Then expose a small class API like DaisyUI:

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-ghost">Cancel</button>

<div class="card">
  <div class="card-body">
    <h2 class="card-title">Settings</h2>
    <p>Configure the app.</p>
  </div>
</div>
```

That gives you the nice “HTML stays readable” feel without depending on Tailwind utilities.

## Start with semantic theme tokens

Do **not** start with `--blue-500`, `--red-600`, etc. Start with app/UI meaning:

```css
:root,
[data-theme="light"] {
  color-scheme: light;

  --color-base-100: oklch(98% 0.01 250);
  --color-base-200: oklch(94% 0.015 250);
  --color-base-300: oklch(88% 0.02 250);
  --color-base-content: oklch(22% 0.03 250);

  --color-primary: oklch(55% 0.18 260);
  --color-primary-content: white;

  --color-secondary: oklch(62% 0.16 320);
  --color-secondary-content: white;

  --color-accent: oklch(70% 0.16 180);
  --color-accent-content: oklch(15% 0.02 180);

  --color-neutral: oklch(28% 0.03 250);
  --color-neutral-content: white;

  --color-info: oklch(65% 0.14 230);
  --color-success: oklch(65% 0.16 145);
  --color-warning: oklch(78% 0.16 80);
  --color-error: oklch(62% 0.2 25);

  --radius-box: 1rem;
  --radius-field: 0.5rem;
  --radius-selector: 0.5rem;

  --border: 1px;
  --depth: 1;
  --noise: 0;

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);
  --shadow-md: 0 8px 24px rgb(0 0 0 / 0.12);

  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

Then dark mode is just another token set:

```css
[data-theme="dark"] {
  color-scheme: dark;

  --color-base-100: oklch(20% 0.02 250);
  --color-base-200: oklch(25% 0.025 250);
  --color-base-300: oklch(32% 0.03 250);
  --color-base-content: oklch(92% 0.02 250);

  --color-primary: oklch(70% 0.16 260);
  --color-primary-content: oklch(15% 0.03 260);

  --color-secondary: oklch(72% 0.13 320);
  --color-secondary-content: oklch(15% 0.03 320);

  --color-accent: oklch(75% 0.14 180);
  --color-accent-content: oklch(12% 0.02 180);

  --color-neutral: oklch(85% 0.02 250);
  --color-neutral-content: oklch(16% 0.02 250);

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3);
  --shadow-md: 0 8px 24px rgb(0 0 0 / 0.4);
}
```

That gives you DaisyUI-style theming without DaisyUI.

## Then build component classes

Start tiny. Do not make 80 components upfront.

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  min-height: 2.5rem;
  padding-inline: 1rem;

  border: var(--border) solid transparent;
  border-radius: var(--radius-field);

  font: inherit;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;

  cursor: pointer;
  user-select: none;

  color: var(--btn-fg, var(--color-base-content));
  background: var(--btn-bg, var(--color-base-200));
  border-color: var(--btn-border, color-mix(in oklch, var(--btn-bg, var(--color-base-200)), black 8%));

  box-shadow: var(--btn-shadow, var(--shadow-sm));

  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    transform 80ms ease,
    box-shadow 120ms ease;
}

.btn:hover {
  background: color-mix(in oklch, var(--btn-bg, var(--color-base-200)), black 6%);
}

.btn:active {
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: 2px solid color-mix(in oklch, var(--btn-bg, var(--color-primary)), white 20%);
  outline-offset: 2px;
}

.btn:disabled,
.btn[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-primary {
  --btn-bg: var(--color-primary);
  --btn-fg: var(--color-primary-content);
}

.btn-secondary {
  --btn-bg: var(--color-secondary);
  --btn-fg: var(--color-secondary-content);
}

.btn-accent {
  --btn-bg: var(--color-accent);
  --btn-fg: var(--color-accent-content);
}

.btn-ghost {
  --btn-bg: transparent;
  --btn-fg: var(--color-base-content);
  --btn-border: transparent;
  --btn-shadow: none;
}

.btn-sm {
  min-height: 2rem;
  padding-inline: 0.75rem;
  font-size: 0.875rem;
}

.btn-lg {
  min-height: 3rem;
  padding-inline: 1.25rem;
  font-size: 1.0625rem;
}
```

Usage:

```html
<button class="btn">Default</button>
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary btn-sm">Small</button>
<button class="btn btn-ghost">Ghost</button>
```

This is the key pattern: base component class plus semantic variants.

## Build forms next

Forms are where desktop apps quickly look inconsistent if you do not standardize them.

```css
.input,
.select,
.textarea {
  width: 100%;
  border: var(--border) solid var(--color-base-300);
  border-radius: var(--radius-field);
  background: var(--color-base-100);
  color: var(--color-base-content);
  font: inherit;
  box-shadow: inset 0 1px 0 rgb(0 0 0 / 0.03);
}

.input,
.select {
  height: 2.5rem;
  padding-inline: 0.75rem;
}

.textarea {
  min-height: 6rem;
  padding: 0.75rem;
  resize: vertical;
}

.input:focus,
.select:focus,
.textarea:focus {
  outline: 2px solid color-mix(in oklch, var(--color-primary), transparent 40%);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

.label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-base-content);
}

.field {
  display: grid;
  gap: 0.375rem;
}
```

Usage:

```html
<label class="field">
  <span class="label">Project name</span>
  <input class="input" type="text" placeholder="My app">
</label>
```

## Cards, alerts, badges, nav

These give you most of the “polished app” feel.

```css
.card {
  border-radius: var(--radius-box);
  background: var(--color-base-100);
  color: var(--color-base-content);
  border: var(--border) solid var(--color-base-300);
  box-shadow: var(--shadow-md);
}

.card-body {
  padding: 1rem;
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding-inline: 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--badge-bg, var(--color-base-200));
  color: var(--badge-fg, var(--color-base-content));
}

.badge-primary {
  --badge-bg: var(--color-primary);
  --badge-fg: var(--color-primary-content);
}

.alert {
  display: flex;
  gap: 0.75rem;
  align-items: start;
  padding: 1rem;
  border-radius: var(--radius-box);
  border: var(--border) solid var(--alert-border, var(--color-base-300));
  background: var(--alert-bg, var(--color-base-200));
  color: var(--alert-fg, var(--color-base-content));
}

.alert-success {
  --alert-bg: color-mix(in oklch, var(--color-success), transparent 85%);
  --alert-border: var(--color-success);
}

.alert-error {
  --alert-bg: color-mix(in oklch, var(--color-error), transparent 85%);
  --alert-border: var(--color-error);
}
```

## Theme switching is trivial

For a wrapped app, you can just set `data-theme` on the document element:

```js
export function setTheme(name) {
  document.documentElement.dataset.theme = name
  localStorage.setItem("theme", name)
}

export function initTheme() {
  const saved = localStorage.getItem("theme")
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.dataset.theme = saved || (systemDark ? "dark" : "light")
}
```

Then:

```html
<button class="btn" onclick="setTheme('light')">Light</button>
<button class="btn" onclick="setTheme('dark')">Dark</button>
<button class="btn" onclick="setTheme('forest')">Forest</button>
```

This is basically the DaisyUI mental model, but owned by you.

## Suggested file layout

For your NAF / Tauri / Wails direction, I’d do:

```text
src/
  index.html
  app.ts
  styles/
    reset.css
    tokens.css
    base.css
    layout.css
    components/
      button.css
      form.css
      card.css
      badge.css
      alert.css
      modal.css
      menu.css
      tabs.css
    themes/
      light.css
      dark.css
      forest.css
      corporate.css
    app.css
```

Then `app.css` imports everything:

```css
@import "./reset.css";
@import "./tokens.css";
@import "./themes/light.css";
@import "./themes/dark.css";
@import "./themes/forest.css";
@import "./base.css";
@import "./layout.css";
@import "./components/button.css";
@import "./components/form.css";
@import "./components/card.css";
@import "./components/badge.css";
@import "./components/alert.css";
```

You can keep this completely dependency-free. A bundler is optional. Modern browsers support CSS imports, though for packaged apps you may still prefer a tiny build step to concatenate CSS into one file.

## I’d deliberately avoid recreating Tailwind

Do **not** create hundreds of utility classes like:

```css
.mt-4 {}
.px-3 {}
.text-sm {}
.bg-primary {}
```

That path slowly turns into Tailwind, except you have to maintain it yourself.

Instead, create a smaller set of durable layout helpers:

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap, 1rem);
}

.cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--cluster-gap, 0.75rem);
}

.split {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.surface {
  background: var(--color-base-100);
  color: var(--color-base-content);
  border: var(--border) solid var(--color-base-300);
  border-radius: var(--radius-box);
}
```

Then use custom properties inline when needed:

```html
<div class="stack" style="--stack-gap: 0.5rem">
  ...
</div>
```

This gives you 80% of utility-class convenience with 5% of the API surface.

## A good minimum component set

For desktop/mobile apps, I’d start with these:

```text
button
input / select / textarea / checkbox / radio / toggle
card
badge
alert
modal / dialog
tabs
menu
navbar / toolbar
drawer / sidebar
dropdown
table
list
progress
spinner
tooltip
```

Do not build carousel, timeline, rating, mockup widgets, etc. until you truly need them.

## Your “DaisyUI-like” API might look like this

```html
<main class="app-shell">
  <aside class="sidebar surface">
    <nav class="menu">
      <a class="menu-item active">Projects</a>
      <a class="menu-item">Settings</a>
    </nav>
  </aside>

  <section class="stack">
    <div class="split">
      <h1>Projects</h1>
      <button class="btn btn-primary">New project</button>
    </div>

    <div class="card">
      <div class="card-body stack">
        <div class="split">
          <h2 class="card-title">NAF GUI App</h2>
          <span class="badge badge-primary">Active</span>
        </div>

        <p>A low-churn wrapped desktop app.</p>

        <div class="cluster">
          <button class="btn btn-primary btn-sm">Open</button>
          <button class="btn btn-ghost btn-sm">Archive</button>
        </div>
      </div>
    </div>
  </section>
</main>
```

That is the sweet spot: readable, themeable, boring, and stable.

## Important recommendation: make a visual test page

Before using it in a real app, create a `kitchen-sink.html` page that shows every component in every state:

```text
buttons: default, hover, active, disabled, loading
inputs: normal, focus, invalid, disabled
cards: normal, compact, bordered
alerts: info, success, warning, error
themes: light, dark, forest, corporate
```

This becomes your replacement for Storybook without the dependency churn. Open it in the browser, Tauri webview, and Wails webview. Make sure it looks right everywhere.

## Best MVP path

Start with:

1. `tokens.css`
2. `light.css` and `dark.css`
3. `base.css`
4. `button.css`
5. `form.css`
6. `card.css`
7. `alert.css`
8. `layout.css`
9. `kitchen-sink.html`

Once that feels good, extract it into something like:

```text
packages/
  monty-ui/
    styles/
      app.css
      themes/
      components/
```

Then every Tauri/Wails/NAF app can import the same stable CSS.

## The philosophy

You are not trying to build “Tailwind but smaller.”

You are building:

> **A small semantic CSS component system with DaisyUI-like theming and boring browser-native primitives.**

That lines up perfectly with your NAF direction. `naf-html` handles behavior and reactivity; your CSS system handles consistent visual language.

[1]: https://daisyui.com/docs/themes/?lang=en&utm_source=chatgpt.com "daisyUI themes — daisyUI Tailwind CSS Component UI Library"
[2]: https://tailwindcss.com/blog/tailwindcss-v4?utm_source=chatgpt.com "Tailwind CSS v4.0 - Tailwind CSS"
