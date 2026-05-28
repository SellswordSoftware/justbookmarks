# Frontend Migration Agent Brief

## Purpose

This document is the compact handoff for an LLM coding agent implementing the frontend rewrite.

Use this together with:

- `docs/plans/frontend-vanilla-naf-migration.md`
- `docs/plans/frontend-vanilla-naf-migration-tasks.md`
- `docs/plans/frontend-parity-checklist.md` once created

## Mission

Replace the current frontend with:

- vanilla JavaScript
- `// @ts-check` and JSDoc for IDE-only typing
- a project-local JS version of `naf-html`
- a home-grown semantic CSS system inspired by DaisyUI

Preserve the existing shipped app behavior while removing reliance on:

- Svelte
- TypeScript source files
- Tailwind
- DaisyUI
- Vite

## Non-Negotiables

- Preserve behavior before improving structure.
- Do not delete the old frontend stack until the new frontend is functional and parity has been checked.
- Keep backend and Wails bindings stable unless a compatibility issue forces a coordinated change.
- Do not re-scope the product based on `prd.md` alone. The current app has more features than the original PRD.
- The tree state and selection model are the highest-risk parts of the migration.

## Primary Source of Truth

When there is ambiguity, use these in order:

1. Current shipped frontend behavior
2. `docs/plans/frontend-vanilla-naf-migration.md`
3. `docs/plans/frontend-vanilla-naf-migration-tasks.md`
4. `prd.md`

## What Must Still Work

At minimum, preserve:

- session startup from CLI file path
- create file / open file flows
- autosave via backend mutations
- tree expand/collapse
- single select, multi-select, range select
- tree keyboard navigation
- search mode and result navigation
- bookmark add/edit/delete
- folder add/rename/delete
- move dialog and drag-and-drop move/reorder
- bulk delete
- bulk title refresh
- bulk favicon refresh
- import/merge preview and apply
- undo/redo
- toasts
- confirm modal
- keyboard shortcuts dialog
- left-pane width persistence
- per-file tree state persistence
- window size persistence
- frameless titlebar behavior
- focus-zone routing

## Target Architecture

Build toward:

- `frontend/index.html` as the HTML-first shell
- `frontend/src/main.js` bootstrap
- `frontend/src/app.js` orchestration
- `frontend/src/lib/naf-html.js` as the local reactive runtime
- `frontend/src/lib/state/*.js` for state ownership
- `frontend/src/lib/features/*.js` for DOM binding modules
- `frontend/src/styles/**` for `daisylite`

Keep modules explicit and small. Do not re-create a framework.

## Execution Protocol

### 1. Work in task order

Use `docs/plans/frontend-vanilla-naf-migration-tasks.md` as the execution list.

Recommended batch order:

- Foundations: T01-T08
- State and shell: T09-T16
- Core interaction surface: T17-T24
- Workflows and dialogs: T25-T31
- Keyboard/history/persistence: T32-T35
- Cutover and verification: T36-T39

### 2. Finish one stable layer before the next

Do not jump ahead if a dependency layer is still unstable.

Especially:

- do not implement UI-heavy modules before state boundaries are clear
- do not delete old stack files before cutover is verified
- do not treat tree rendering as done until keyboard and selection parity are tested

### 3. Prefer direct behavioral ports

For high-risk logic, port behavior with minimal semantic drift first:

- tree state
- selection rules
- keyboard routing
- debounce/fetch behavior
- persistence behavior

Cleanups can happen after parity is proven.

### 4. Verify before claiming completion

For each completed task:

- run the relevant build or local check if possible
- verify the specific behavior the task claims to restore
- record any known gap instead of silently assuming it works

### 5. Keep changes legible

- use JS + JSDoc
- keep public module APIs explicit
- avoid hidden global coupling
- keep CSS semantic, not utility-heavy

## Risk Focus

Spend extra care on:

- `tree-state.js`
- tree rendering
- range and multi-select constraints
- drag-and-drop semantics
- focus-zone coordination
- global shortcuts
- undo/redo refresh behavior

If these regress, the rewrite is not acceptable even if the shell looks correct.

## Minimal Verification Standard

Before marking a major area complete, confirm:

- shell loads without Svelte
- Wails bridge calls still work
- tree data renders correctly
- selection behaves correctly under mouse and keyboard
- dialogs trap focus correctly
- persistence still round-trips valid data
- the build still produces `frontend/dist`

Before declaring the migration finished, run the full parity checklist.

## Stop Conditions

Stop and reassess if:

- the new architecture requires backend API changes for basic parity
- tree selection behavior is diverging from the current app and the difference is not intentional
- the no-Vite approach prevents practical Wails development and a temporary minimal dev server is needed
- CSS API growth starts turning into an accidental Tailwind clone

## Suggested Agent Prompt

Use this prompt with an implementation agent:

```text
You are implementing the JustBookmarks frontend migration.

Read these files first:
- docs/plans/frontend-vanilla-naf-migration.md
- docs/plans/frontend-vanilla-naf-migration-tasks.md
- docs/plans/frontend-parity-checklist.md if it exists

Your goal is to replace the current Svelte/TypeScript/Tailwind/DaisyUI/Vite frontend with a vanilla JS frontend that uses:
- // @ts-check
- JSDoc types
- a local JS version of naf-html
- a home-grown semantic CSS system

Rules:
- Preserve shipped behavior before improving structure.
- Keep the Go backend and Wails bindings stable unless a compatibility issue forces a coordinated change.
- Do not delete the old frontend stack until the new frontend is working and parity has been checked.
- Follow the task list in dependency order.
- Verify behavior before claiming a task is complete.
- When behavior is unclear, prefer the current frontend implementation over the original PRD.

Start with the next incomplete task from docs/plans/frontend-vanilla-naf-migration-tasks.md.
State which task you are executing, complete it end-to-end, verify it, and then report:
- what changed
- what was verified
- any remaining gaps or risks
```

## Expected Reporting Format

After each task or batch, report:

- task IDs completed
- files added or changed
- behavior verified
- blockers or unresolved risks
- whether the next task can proceed

## Final Completion Standard

The migration is complete only when:

- the new frontend is active
- the old stack is removed
- the app builds and runs through Wails
- the parity checklist is fully verified
- docs are updated to describe the new stack
