# Frontend Maintainability Guidelines

## Purpose

This frontend does not need heavy process, but it does need consistent pressure toward clear ownership and small-enough modules.

The goal is:

- easy scanning
- predictable module boundaries
- low-risk edits
- fewer files that mix shell code, product behavior, and async workflows

## Reader

This document is for engineers changing frontend modules.

After reading it, you should be able to:

- decide when a file should be split
- keep NAF-based modules readable
- avoid turning the runtime into a framework
- separate shell composition from interaction-heavy logic

## Core Rule

Split files by responsibility, not just by line count.

A module should usually be reviewed when it starts owning more than one of these concerns:

- shell markup
- local reactive state
- input binding
- async workflows
- backend mutations
- keyboard rules
- pointer or drag-and-drop rules
- list row behavior

Large files are acceptable when they are cohesive. Small files are bad if they fragment one idea across too many places.

## File Size Heuristics

Use these as review triggers, not hard limits:

- `150-250` lines: healthy target for many modules
- `300-400` lines: acceptable when cohesive
- `400+` lines: review for extraction opportunities
- `600+` lines: usually justify why they are still one module

A `220` line file can still be worse than a `380` line file if it mixes too many responsibilities.

## The Main Split

For this codebase, the most important maintainability split is:

- shell composition versus interaction-heavy logic

Shell composition usually means:

- `template()` markup
- a few local refs or element lookups
- a bounded listener set
- mount and unmount cleanup

Interaction-heavy logic usually means:

- many field bindings
- many effects
- keyboard rules
- drag and drop
- row-level state updates

Keep these two modes distinct. Do not build giant modules that do both equally.

## Preferred Boundaries

### Pages

Pages should own:

- screen-level composition
- shell visibility rules
- page-specific mounts

Pages should not absorb deep feature internals.

If a page file grows, extract:

- page-local shell helpers
- feature mounts
- page-specific UI helpers

### Features

A feature should usually own one product surface.

If a feature grows, split out:

- state owner
- async workflow helpers
- row or sub-view renderers
- keyboard or pointer interaction systems
- shell builders when markup is significant

Do not split a feature into fragments so small that the workflow becomes harder to follow.

### Components

Components should stay bounded.

A component should usually do one of these jobs:

- render shell markup
- own a contained interaction surface
- provide dialog or toolbar chrome

If a component starts owning product workflow, move that behavior into a feature.

### Shared

Shared code should be hard to earn.

Only create or grow shared abstractions when:

- the reuse is real
- the abstraction is simpler than duplication
- the name still describes what it does without knowing the old caller

## NAF-Specific Guidance

### Use NAF templates for shell locality

Use `template()` when the main benefit is:

- keeping markup next to behavior
- reducing `index.html` growth
- making mount and cleanup easier to scan

Do not convert every module to `template()` by default.

### Use NAF helpers for fine-grained behavior

Use low-level helpers when they make repeated patterns clearer:

- `signal()`
- `computed()`
- `effect()`
- `fx()`
- `model()`
- `list()`
- `cleanupCollector()`
- `listener()`

For template-backed shell modules, also prefer:

- `mount()` for dedicated host mounting
- `data-ref` plus `ctx.refs` for owned nodes

If the helper makes the module harder to understand, do not force it.

### Keep imperative ownership where it is better

Direct DOM code is still the right choice for:

- tree rendering
- tree rows
- search result rows
- drag and drop
- keyboard-heavy widgets
- dense detail editing surfaces

The goal is maintainability, not uniformity.

## Practical Split Triggers

Review a file when you notice any of these:

- repeated render-style DOM syncing
- repeated `querySelector()` calls for elements already owned by one template
- more than one local state machine
- large listener registration blocks
- async workflow logic mixed with shell composition
- deeply nested branching that slows scanning
- several helper functions with unrelated reasons to change
- difficulty naming the file after one responsibility

## Good Extraction Targets In This Frontend

Common extraction targets in this codebase:

- dialog option or row renderers
- detail metadata workflows
- form state wiring
- tree row interaction helpers
- keyboard handling systems
- async mutation helpers
- shell builders for bounded feature surfaces

## What Not To Do

Avoid these patterns:

- splitting by line count alone
- extracting tiny helpers that hide straightforward code
- creating generic abstractions too early
- moving code into shared modules just to reduce imports
- mixing shell markup, backend mutation, and interaction rules in one large file when the boundaries are already clear

## Review Checklist

When touching a frontend file, ask:

1. Does this file still have one clear responsibility?
2. Is this module mostly shell composition or mostly interaction logic?
3. Should the shell portion be a NAF template?
4. Is local state kept local, and shared state kept shared?
5. Is cleanup centralized and obvious?
6. Would a submodule make future edits safer and clearer?
7. Did the abstraction make the code simpler, or just more indirect?

For shared state modules, also ask:

8. Does the module follow the canonical signals/actions/computed/selectors pattern?
9. Are private signals kept module-scoped and only exposed via the signals namespace?
10. Do selectors read state and actions write state, with no overlap?

If those answers are weak, split the file or simplify the abstraction.

## Maintenance Rule

Keep modules boring to read.

If a future editor can understand:

- what the module owns
- where the state lives
- how it mounts
- how it cleans up

without reconstructing hidden conventions, the file is in good shape.
