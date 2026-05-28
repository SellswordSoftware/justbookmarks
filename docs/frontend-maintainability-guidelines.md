# Frontend Maintainability Guidelines

## Purpose

This project does not need rigid file-size rules, but it does need consistent pressure toward small, legible modules.

The goal is:

- easy scanning
- obvious ownership
- low-risk edits
- fewer files that mix unrelated concerns

## File Size Guidelines

Use these as heuristics, not hard laws:

- `150-250` lines: healthy target for most frontend modules
- `300-400` lines: acceptable if the module is cohesive and still easy to scan
- `400+` lines: review for extraction opportunities
- `600+` lines: should usually be split unless the file is mostly static data or intentionally centralized

Line count alone is not enough. A `220` line file can still be worse than a `380` line file if it mixes too many responsibilities.

## Primary Rule

Split files based on responsibility, not just length.

A file should usually be broken up when it has more than one real reason to change.

In this frontend, the common reasons to split are:

- state ownership
- DOM structure creation
- reactive bindings
- async workflows
- keyboard and pointer interaction rules
- reusable row/item renderers
- formatting or display helpers

## Recommended Boundaries

### `state/*`

Keep state modules focused on:

- signals
- computed values
- selectors
- actions

Avoid mixing DOM code into state modules.

### `features/*`

A feature module should usually own one UI surface.

Examples:

- tree
- detail panel
- one dialog
- one form

If a feature grows large, split out:

- sub-renderers
- list-row renderers
- helper functions
- async workflow helpers

### `naf-html` helpers

If the same DOM/event/effect pattern appears in multiple modules, prefer improving or using the helper layer instead of re-implementing it.

But do not force every module into abstraction if the result is less clear.

## Practical Split Triggers

Strong signals that a file should be reviewed for extraction:

- repeated `render()`-style imperative DOM syncing
- more than one local state machine in the same file
- long blocks of event listener registration and cleanup
- a mix of UI rendering and backend mutation orchestration
- nested loops or branching that make scanning slow
- difficulty naming the file after a single responsibility

## Project-Specific Guidance

For this codebase:

- start reviewing files for splits around `350` lines
- require a conscious reason to keep a file above `500` lines
- prefer extracting by responsibility instead of arbitrary chunking

Good extraction targets in this frontend include:

- dialog option/row renderers
- detail-panel edit flows
- metadata fetch workflows
- tree row interaction helpers
- repeated form state wiring

## What Not To Do

- do not split files into tiny fragments that are harder to follow than the original
- do not create generic abstractions too early
- do not move logic out just to reduce line count if cohesion gets worse

The aim is not “small files at all costs”. The aim is clear ownership and lower maintenance cost.

## Review Checklist

When touching a large frontend file, ask:

1. Does this file still have one clear responsibility?
2. Are state, DOM, and async logic separated well enough to scan quickly?
3. Is there repeated wiring that should use `naf-html` helpers instead?
4. Would extracting a submodule make future edits safer and clearer?
5. If the file stays large, is there a concrete reason it is better kept together?

If those answers are weak, split the file.
