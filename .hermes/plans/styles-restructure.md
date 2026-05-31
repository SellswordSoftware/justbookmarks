# Styles Restructure Plan

## Goal

Move all CSS into `styles/` with proper subdirectories. Co-locate feature/component-specific styles with their code. Remove `shared/styles/`.

## Current state

- `styles/` - app infrastructure CSS (reset, tokens, themes, base, layout, app.css barrel)
- `shared/styles/` - mixed UI primitives + feature-specific dialog styles
- Component/feature CSS co-located in their directories (titlebar.css, toast.css, etc.)

## Steps

### Step 1: Create `styles/primitives/` and move UI primitives

Move these from `shared/styles/` to `styles/primitives/`:
- button.css
- form.css
- card.css
- modal.css
- alert.css
- badge.css
- menu.css
- spinner.css
- icon-mask.css

### Step 2: Split `dialogs-extra.css` into co-located files

Extract from `shared/styles/dialogs-extra.css`:
- `.move-dialog*` classes -> `features/move/move-dialog.css`
- `.confirm-modal*` classes -> `components/confirm-modal/confirm-modal.css` (append to existing)
- `.shortcuts-dialog*` classes -> `components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.css` (new)
- `.import-merge-dialog*` classes -> `features/import-merge/import-merge-dialog.css` (new)
- `@media` queries split with their respective dialog styles

### Step 3: Update `app.css` barrel file

Update imports:
- `../shared/styles/button.css` -> `./primitives/button.css`
- `../shared/styles/icon-mask.css` -> `./primitives/icon-mask.css`
- `../shared/styles/form.css` -> `./primitives/form.css`
- `../shared/styles/card.css` -> `./primitives/card.css`
- `../shared/styles/modal.css` -> `./primitives/modal.css`
- `../shared/styles/alert.css` -> `./primitives/alert.css`
- `../shared/styles/badge.css` -> `./primitives/badge.css`
- `../shared/styles/menu.css` -> `./primitives/menu.css`
- `../shared/styles/spinner.css` -> `./primitives/spinner.css`
- `../shared/styles/dialogs-extra.css` -> remove (styles now co-located)

Add new co-located imports:
- `../components/confirm-modal/confirm-modal.css` (already imported? check)
- `../components/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.css` (new)
- `../features/move/move-dialog.css` (new)
- `../features/import-merge/import-merge-dialog.css` (new)

### Step 4: Delete `shared/styles/` directory

### Step 5: Verify

```bash
cd frontend && npm run typecheck && npm run build
```
