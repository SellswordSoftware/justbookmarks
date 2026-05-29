# M001: Frontend Migration Toward Svelte-Like Locality and DX

**Vision:** Evolve the current vanilla JavaScript + NAF frontend into a more Svelte-like authoring model by improving component locality, simplifying state consumption, and moving bounded shell markup into module ownership while preserving the layered architecture and imperative handling of interaction-heavy surfaces.

## Success Criteria

- A contributor can understand and modify a bounded page, dialog, or shell component primarily from its owning module rather than reconstructing behavior across `index.html`, broad shell collectors, and repeated DOM queries.
- The app still supports empty-state boot, file open/create flow, page switching, search, tree browsing, detail editing, and dialogs with no user-visible regressions.
- `index.html` acts as a real shell and no longer carries page/detail placeholder content or bounded surface markup that modules can own themselves.
- The runtime and authoring docs make the preferred pattern for new frontend work obvious and repeatable.

## Key Risks / Unknowns

- The runtime changes could become over-engineered and harder to reason about than the current simple primitives.
- Hidden coupling between `create-app.js`, shell anchors, and page modules may only surface once markup ownership moves.
- State API simplification may be straightforward for app/page composition but awkward for larger feature state modules.

## Proof Strategy

- Runtime over-engineering risk → retire in S01 by proving a scoped component/ref API can be added while keeping the interface small and existing consumers working.
- Shell/app hidden-coupling risk → retire in S03 by proving a migrated shell surface can mount cleanly from module-owned markup without depending on broad app-level selector scavenging.
- State API simplification risk → retire in S06 by proving at least one real page/app composition path reads more cleanly without destabilizing feature state internals.

## Verification Classes

- Contract verification: `frontend/npm run typecheck`, `frontend/npm run build`, and any targeted tests added for runtime helpers.
- Integration verification: real Wails app flow through empty state, file open/create, library page mount, dialog flows, and shell behavior.
- Operational verification: mount/unmount cleanup across page switches and dialog open/close cycles remains correct; no new lifecycle boundary beyond the existing app runtime.
- UAT / human verification: titlebar behavior, focus behavior, page transitions, and shell-local correctness after markup migration.

## Milestone Definition of Done

This milestone is complete only when all are true:

- All slices are complete and their promised surfaces are actually used by the app.
- The strengthened runtime, migrated shell modules, lighter state-consumption surface, and thinner app/page composition are wired together in the real app.
- `index.html` has been reduced to true shell anchors and necessary imperative templates.
- Frontend success criteria are re-checked against live behavior, not only code structure.
- Final integrated acceptance scenarios from the milestone context pass in a real Wails run.

## Requirement Coverage

- Covers: R001, R002, R003, R004
- Partially covers: none
- Leaves for later: any deeper feature-state modernization beyond the bounded migration surface
- Orphan risks: none beyond the open questions called out in the milestone context

## Slices

- [ ] **S01: Add scoped component ownership to NAF** `risk:high` `depends:[]`
  > After this: one migrated example or compatibility harness proves NAF components can mount with local refs and scoped ownership instead of parent-wide selector searches.
- [ ] **S02: Publish the new component authoring pattern** `risk:medium` `depends:[S01]`
  > After this: contributors have a documented, copyable pattern for refs, mount/unmount, cleanup, and child composition under the updated runtime.
- [ ] **S03: Migrate one bounded shell component end-to-end** `risk:high` `depends:[S01]`
  > After this: a real bounded shell such as the titlebar works from module-owned markup using the new runtime pattern and no longer depends on broad parent-scoped querying.
- [ ] **S04: Migrate dialogs into module-owned shell markup** `risk:medium` `depends:[S01,S03]`
  > After this: confirm, move, import/merge, and keyboard-shortcuts dialog shells use the new local ownership model while preserving current workflows.
- [ ] **S05: Reduce `index.html` to true shell infrastructure** `risk:medium` `depends:[S03,S04]`
  > After this: page/detail placeholder content and migrated bounded shell markup are gone from `index.html`, leaving only stable anchors and sanctioned imperative templates.
- [ ] **S06: Introduce a lighter state-consumption surface for app/page UI** `risk:medium` `depends:[S01]`
  > After this: at least one real app/page composition path consumes state through a simpler store-like interface than the current broad selector/action wrapper style.
- [ ] **S07: Refactor page composition around local ownership** `risk:high` `depends:[S05,S06]`
  > After this: the empty-library and library page flows are easier to read because page-level shell ownership and page switching no longer rely on scattered shell toggles and oversized shell collection.
- [ ] **S08: Thin `create-app.js` and stabilize page hosting boundaries** `risk:medium` `depends:[S07]`
  > After this: app bootstrap is focused on startup, global singletons, and active-page hosting rather than owning most shell details.
- [ ] **S09: Validate imperative feature exceptions and remove migration leftovers** `risk:low` `depends:[S07,S08]`
  > After this: tree, detail, DnD, and keyboard-heavy modules are explicitly preserved as imperative where appropriate, and obsolete helpers/boilerplate introduced by the old model are removed.
- [ ] **S10: Update docs and perform final integrated verification** `risk:low` `depends:[S08,S09]`
  > After this: the repo documents the new frontend model clearly, and the full empty-state-to-library flow plus dialogs and shell behavior are re-verified in the real app.

## Horizontal Checklist

- [ ] Every active R### re-read against new code — still fully satisfied?
- [ ] Every architecture guideline doc re-evaluated — still valid at new scope?
- [ ] Graceful shutdown / cleanup on termination verified
- [ ] Revenue / billing path impact assessed (or N/A)
- [ ] Auth boundary documented — what's protected vs public
- [ ] Shared resource budget confirmed — connection pools, caches, rate limits hold under peak
- [ ] Reconnection / retry strategy verified for every external dependency

## Boundary Map

### S01 → S02

Produces:
- A stable NAF component contract for scoped mount ownership, local refs, and nested composition
- Compatibility expectations for existing `template()` consumers

Consumes:
- nothing (first slice)

### S01 → S03

Produces:
- The runtime primitives needed to migrate a real shell component without parent-wide selector searches

Consumes:
- nothing (first slice)

### S03 → S04

Produces:
- A proven bounded-shell migration example, including local markup ownership, local refs, and explicit cleanup

Consumes:
- Scoped runtime primitives from S01

### S03 → S05

Produces:
- Confidence that migrated shell markup can leave `index.html` without regressing app behavior

Consumes:
- Scoped runtime primitives from S01

### S01 → S06

Produces:
- A stable runtime baseline that new state consumption patterns can target in real UI modules

Consumes:
- nothing (first slice)

### S05 → S07

Produces:
- A slimmer shell file and clear anchors for page-owned markup

Consumes:
- Migrated bounded shell ownership from S03 and S04

### S06 → S07

Produces:
- A lighter app/page state-consumption surface for page composition

Consumes:
- Runtime baseline from S01

### S07 → S08

Produces:
- Clear page host boundaries and page-owned composition patterns

Consumes:
- Slimmed shell from S05
- Lighter page-facing state API from S06

### S07 → S09

Produces:
- A final view of which remaining modules should stay imperative

Consumes:
- Page composition boundaries from S07

### S08 → S10

Produces:
- Stable bootstrap and page-host ownership suitable for documentation and final verification

Consumes:
- Page-composition refactor from S07

### S09 → S10

Produces:
- A cleaned codebase with imperative exceptions and obsolete migration leftovers resolved

Consumes:
- Refined app/page/runtime boundaries from earlier slices
