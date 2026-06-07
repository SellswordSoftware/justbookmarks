# Style System Guidelines

## Layer Responsibilities

Use the stylesheet layers in this order:

1. `reset`
2. `tokens`
3. `themes`
4. `base`
5. `primitives`
6. `components`
7. `features`
8. `utilities`

Keep each layer narrow:

- `tokens.css` defines shared scales, semantic token names, and neutral fallbacks.
- `themes/*.css` assign theme values only.
- `primitives/` define reusable building blocks.
- `components/` consume primitives and exposed component hooks.
- `features/` style product-specific screens and workflows.

## Theme Rules

- Theme selectors like `[data-theme="light"]` and `[data-theme="dark"]` belong only in `src/styles/themes/`.
- Component and feature CSS should consume semantic variables instead of branching on theme.
- If a new visual state needs theme-specific values, add a semantic token in `tokens.css` and assign it in each theme file.

## Tokens And Variables

- Prefer semantic tokens such as `--color-border-quiet`, `--padding-panel`, and `--radius-panel`.
- Use primitive-private variables for local implementation details, for example `--_btn-bg`.
- Do not add raw colors to component or feature CSS.
- Add a new global token only when the value expresses shared semantics across more than one surface.

## Primitives

- Create or extend a primitive when the same structure appears in multiple places.
- Prefer variable hooks over descendant overrides when a component needs feature-specific tuning.
- Do not force every surface into the same primitive if the structure or behavior diverges materially.

## Guardrails

Run this before finishing style work:

```bash
npm run typecheck
npm test
```

Add browser verification when the style change affects rendered UI behavior, focus treatment, or layout-sensitive interactions:

```bash
npm run test:browser
```

There is no current repo script for style-only linting. Do not document `npm run lint:styles` unless that script is restored.

Current styling guardrails are enforced by convention and review:

- no `[data-theme=...]` selectors outside `src/styles/themes/`
- no raw color values outside `tokens.css` and `themes/*.css`
- consistent custom property naming, including private `--_primitive-*` vars
