# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - Next

### Changed

- Rewrote the frontend to remove the prior Svelte, Tailwind, and DaisyUI stack in favor of project-local, home-grown UI and state primitives.
- Replaced framework-driven component patterns with a local `naf-html` runtime and explicit feature/state modules to reduce dependency churn and make behavior easier to trace.
- Reworked styling around repo-owned CSS modules and local UI conventions instead of utility-framework and theme-library dependencies.

### Improved

- Increased frontend stability by reducing exposure to upstream framework, plugin, and design-system breakage.
- Reduced maintenance churn by moving core rendering, state wiring, and UI patterns into code owned directly by this repository.
- Improved maintainability by splitting large frontend modules into smaller state, feature, lifecycle, and styling boundaries.

### Notes

- This release is intended to keep the app simpler to evolve over time, with fewer moving parts outside the repository.
- The rewrite preserves the desktop bookmark manager workflow while shifting implementation ownership in-house.
