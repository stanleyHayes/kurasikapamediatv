# ADR-0007 — Toolchain version pins

**Status:** Accepted · 2026-08-08
**Deciders:** Engineering Lead

## Context

Two "latest" versions available on 2026-08-08 are incompatible with the rest of the stack. Both were caught by reading peer ranges before writing code rather than after a failing install.

## Decision

### TypeScript pinned to `5.9.3`, not `7.0.2`

`typescript-eslint@8.66.0` declares `"typescript": ">=4.8.4 <6.1.0"`. The native TypeScript 7 compiler is outside that range, so adopting it means no type-aware linting — and type-aware rules are how several of our quality gates are enforced.

Losing the lint layer to gain compile speed is the wrong trade on a codebase whose main risk is scope, not build time. Revisit when `typescript-eslint` ships TS 7 support.

### MongoDB driver pinned to `6.21.0`, not `7.5.0`

**Original reason, now obsolete:** `@auth/mongodb-adapter@3.11.3` declared `"mongodb": "^6"`, so driver v7 broke it. That constraint disappeared when [ADR-0004](adr-0004-better-auth.md) moved us to Better Auth, whose Mongo adapter accepts `^6.0.0 || ^7.0.0`.

**Current reason:** we stay on 6.21.0 by choice, not by force. `packages/adapter-mongo` is written and tested against the v6 API, v7 carries breaking changes, and there is no capability we need on the other side. Revisit when there is a reason beyond the version number being larger.

Recording the obsolete reason rather than deleting it: a pin whose justification has quietly expired is how a codebase accumulates constraints nobody can explain.

### Other pins

| Package | Pin | Note |
|---|---|---|
| `next` | 16.3.0 | Cache Components require 16+ |
| `react` | 19.2.8 | matches Next 16 |
| `eslint` | 10.8.1 | `typescript-eslint@8` supports `^10` |
| `vitest` | 4.1.10 | |
| `zod` | 4.4.3 | `ai@7` peers `^3.25.76 \|\| ^4.1.8` |
| `tailwindcss` | 4.3.3 | |
| Node | 26.x | |
| Go | 1.26 | |

## Consequences

**Good.** The dependency graph installs clean with no peer overrides, and full type-aware linting works from commit one.

**Cost.** We are behind latest on two packages and must track both upgrade paths. Both are recorded in `.raven/manifest.json` under `stack.pinned_reasons`, so the reason survives after everyone has forgotten it.

**Rule.** Neither pin may be raised without re-checking the peer range that caused it. A green `pnpm install` with `--force` is not evidence.
