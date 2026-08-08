# ADR-0008 — Internal packages ship TypeScript source, not builds

**Status:** Accepted · 2026-08-08
**Deciders:** Engineering Lead

## Context

`packages/*` were written with explicit `.js` extensions on relative imports — the Node16 ESM convention. TypeScript accepted it and every unit test passed. The first `next build` then failed across every package with `Module not found: Can't resolve './documents.js'`.

The two conventions are genuinely incompatible:

- **Node ESM** requires the extension, and requires it to say `.js` even when the file on disk is `.ts`.
- **Bundler resolution** (Turbopack, Vite, webpack) resolves extensionless imports and does not perform the `.js` → `.ts` rewrite.

## Decision

Internal packages are **just-in-time packages**: they export `./src/index.ts` directly, relative imports carry no extension, and `apps/web` lists them in `transpilePackages`.

`moduleResolution` stays `bundler`, which is what makes this type-check correctly.

## Consequences

**Good.** No build step between editing a domain rule and seeing it in the running app. One source of truth per package, no `dist/` to go stale, and Turbopack tree-shakes across package boundaries because it sees real source.

**Cost.** These packages cannot be `node`-executed directly and cannot be published to a registry as they stand. Both are fine today: nothing runs them outside Next or Vitest, and they are private to this repository.

**If that changes** — a CLI, a script under plain `node`, or publishing to npm — the fix is a `tsc` build step per package plus `exports` pointing at `dist/`, not restoring the extensions. Restoring them would break the bundler again.

**Lesson worth keeping.** `tsc --noEmit` passing is not evidence that a bundler can resolve the graph. The build is a separate gate, and it now runs in CI for exactly this reason.
