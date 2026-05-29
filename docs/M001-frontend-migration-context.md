# M001: Frontend Migration Toward Svelte-Like Locality and DX

**Gathered:** 2026-05-29
**Status:** Ready for planning

## Project Description

This milestone refines the current vanilla JavaScript + NAF frontend so it preserves the existing layered architecture and imperative-performance-sensitive surfaces while moving closer to the parts of Svelte that improve day-to-day frontend work: local markup ownership, scoped component lifecycles, simpler reactive state consumption, and clearer page-level composition.

## Why This Milestone

The frontend has already been restructured into sensible layers, but the current developer experience still spreads UI ownership across `index.html`, app-level shell collection, local query helpers, and broad state wrapper APIs. That makes bounded UI work more expensive than it should be. This milestone exists to close that gap without abandoning the current architecture, introducing a router, or forcing dense tree/detail surfaces into a templating model that is worse for them.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Use the app exactly as today while the frontend internals are easier to change safely.
- Open, create, search, browse, edit, move, and manage bookmark content with no behavior regressions from the migration.
- Benefit from more reliable dialog, page, and shell behavior because mount/unmount ownership is more explicit and localized.

### Entry point / environment

- Entry point: Wails desktop application launched through `wails dev` or the packaged app
- Environment: local dev and packaged desktop runtime
- Live dependencies involved: Wails runtime bindings and the existing Go backend; no new external service dependency

## Completion Class

- Contract complete means: the runtime/component API, state consumption surface, and migrated shell modules typecheck and build cleanly with stable documented ownership rules.
- Integration complete means: the app boots, page switching works, shell components mount/unmount correctly, dialogs still function, and imperative feature modules continue to work through the new boundaries.
- Operational complete means: no special operational lifecycle beyond normal Wails app startup/shutdown is introduced; cleanup and mount lifetimes must remain correct across page switches and dialog opens/closes.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- A user can launch the app into the empty-library state, open or create a bookmark file, and reach the library state with no missing shell UI or broken page transitions.
- A user can use migrated bounded surfaces such as titlebar, dialogs, and page shells while tree, detail, search, and keyboard-heavy workflows continue to operate correctly.
- The frontend `index.html` shell is reduced to stable anchors and truly necessary static templates, with bounded module markup moved into module-local ownership.
- Frontend verification passes through `npm run typecheck` and `npm run build`, and the integrated desktop behavior is re-checked manually in a real Wails run.

## Architectural Decisions

### Strengthen NAF Before Broad Surface Migration

**Decision:** Upgrade the local NAF runtime first so components have scoped mount ownership, local refs, and safer nested composition before moving more UI markup out of `index.html`.

**Rationale:** The current runtime is too shallow to support Svelte-like locality cleanly. If shell markup is migrated first, the result will still rely on broad parent queries and fragile selector coupling. Runtime improvements create a stable authoring model that later migrations can reuse.

**Alternatives Considered:**
- Migrate markup out of `index.html` first — rejected because it would preserve the current parent-scoped composition problems and duplicate boilerplate.
- Simplify stores first — rejected because it improves call-site ergonomics but does not solve component locality or mount safety.

### Keep Dense Tree and Detail Internals Imperative by Default

**Decision:** Continue using direct DOM ownership for tree rendering, drag and drop, keyboard-heavy widgets, and dense detail/editing surfaces unless a bounded shell extraction clearly improves maintainability.

**Rationale:** The project already has the right instinct here. These surfaces are dominated by incremental DOM updates and interaction rules, not by shell-local markup composition. Forcing them into a templating model for consistency would move away from the maintainability goals.

**Alternatives Considered:**
- Convert all feature surfaces to the template model for uniformity — rejected because it would increase indirection and likely regress clarity in the most interaction-heavy modules.

### Introduce a Lighter Store-Oriented Consumption Surface

**Decision:** Keep current state internals initially, but expose a lighter consumption model for new UI code so state reads and writes are less ceremonious than the current `signals/actions/selectors` wrapper pattern.

**Rationale:** The present state shape is disciplined but verbose. A lighter store-like surface gets closer to Svelte’s ergonomics without paying the risk of a full state rewrite during the same milestone.

**Alternatives Considered:**
- Leave state APIs unchanged and only refactor rendering — rejected because the resulting DX would still be notably farther from the desired authoring style.
- Rewrite `treeState` and all feature state at once — rejected because it couples too much risk into one milestone and is not needed to get most of the benefit.

## Error Handling Strategy

This milestone should preserve the current user-facing error behavior. Runtime and component migration work must fail loudly during development when required refs or shell anchors are missing, but it should not introduce new silent fallback behavior that hides broken ownership. Existing app errors such as file open/save issues, import problems, and backend failures should continue to flow through the current feature and UI paths unchanged. During migration, cleanup paths must be explicit so page switches and dialog unmounts do not leave dangling listeners, effects, or document-level handlers behind.

## Risks and Unknowns

- Runtime redesign becomes a mini-framework rewrite — that would slow the milestone and make the interface harder to trust.
- Component-local ref/mount APIs may need one iteration to balance ergonomics with simplicity — this affects every later slice.
- Page and shell ownership may expose hidden coupling currently embedded in `create-app.js` and `index.html`.
- State API simplification may be easy for app/page state but less obvious for feature-heavy state modules — especially `treeState`.

## Existing Codebase / Prior Art

- `shared/runtime/naf.js` — current reactive/template runtime and the main place where component locality must improve.
- `app/create-app.js` — current shell collection and top-level mounting logic; likely to shrink and become more focused.
- `pages/library` and `pages/empty-library` — current page-level composition and shell visibility control; strong candidates for cleaner local ownership.
- `components/titlebar`, `components/confirm-modal`, `components/keyboard-shortcuts-dialog` — bounded shell modules that are good early migration targets.
- `features/move` and `features/import-merge` dialogs — feature-owned bounded shells that should benefit from the improved runtime.
- `features/tree` and `features/detail` — interaction-heavy surfaces that should mostly remain imperative under the new model.
- Frontend architecture and maintainability docs — current rules that this milestone should preserve while tightening execution.

## Relevant Requirements

- R001 — Preserve all current bookmark-management workflows while improving frontend maintainability and authoring ergonomics.
- R002 — Keep the layered frontend structure as the source of truth during migration.
- R003 — Keep page switching state-driven and avoid introducing route-based navigation.
- R004 — Use NAF templates where markup locality helps while preserving imperative DOM ownership where it is the better fit.

## Scope

### In Scope

- Improving `naf.js` component composition and ref ownership.
- Migrating bounded shell markup out of `index.html` into module-local templates.
- Simplifying state consumption surfaces for app/page-oriented UI code.
- Refactoring app/page composition to reduce shell scavenging and make page ownership clearer.
- Updating frontend docs to reflect the new authoring model.

### Out of Scope / Non-Goals

- Replacing the frontend with Svelte or another framework.
- Introducing a router or URL-driven page state.
- Rewriting tree rendering, drag and drop, or dense detail editing purely for consistency.
- Large visual redesign or product workflow changes.
- Broad backend or Wails integration redesign.

## Technical Constraints

- Frontend remains plain JavaScript with `// @ts-check`.
- Vite remains a build tool, not a component compiler source of truth.
- The layered frontend structure remains the organizing model.
- `naf.js` remains the single runtime entrypoint rather than splitting into competing helper stacks.
- Wails shell anchors required by the desktop runtime must remain stable.
- Verification must continue to work through `npm run typecheck` and `npm run build`.

## Integration Points

- Wails runtime bindings — titlebar/window state and desktop shell behavior must continue to work.
- Existing Go backend bindings — current API and state workflows must remain intact during migration.
- Existing persistence and app lifecycle modules — page/shell cleanup and persisted UI state must remain correct.

## Testing Requirements

The milestone needs contract verification through frontend typecheck/build on every slice that changes runtime or UI composition. It also needs integration verification by exercising the real app entry flow in Wails: empty state, file open/create transition, library page mount, search shell, detail shell, and dialog flows. Manual verification is required for titlebar behavior, page switching, keyboard focus behavior around migrated shells, and any document-level listeners introduced or preserved by imperative modules. New automated tests are optional where they clearly lock down runtime behavior, but build/typecheck and real UI checks are mandatory.

## Acceptance Criteria

- `naf.js` provides a documented component model with scoped mount ownership and local refs.
- Nested component composition no longer depends on searching the entire parent tree for child roots.
- `index.html` is reduced to shell anchors and truly necessary static templates.
- Bounded shells such as titlebar, empty state, and dialogs own their markup in their module files.
- `create-app.js` becomes thinner and no longer acts as the owner of most surface-level shell detail.
- New or migrated page/component code can consume state through a lighter interface than the current broad selector/action wrapper style.
- Tree, drag and drop, keyboard-heavy modules, and dense detail rendering continue to work without being forced into template-heavy abstractions.
- Frontend docs describe the updated model clearly enough for future contributors to follow it mechanically.

## Open Questions

- What is the smallest useful local-ref API for NAF: explicit `ref()` helpers, attribute-based refs, or another scoped binding approach?
- Should the tree/search result `<template>` nodes remain in `index.html` permanently as sanctioned imperative exceptions, or should they eventually move to feature-owned template assets?
- How far should the lighter state-consumption surface go in this milestone: only `appState` and page-facing state, or a second pass into selected feature modules as well?
