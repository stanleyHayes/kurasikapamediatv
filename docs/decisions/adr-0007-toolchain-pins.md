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
| `next` | 16.2.12 | Cache Components require 16+ |
| `react` | 19.2.8 | matches Next 16 |
| `eslint` | 10.8.1 | `typescript-eslint@8` supports `^10` |
| `vitest` | 4.1.10 | |
| `zod` | 4.4.3 | `ai@7` peers `^3.25.76 \|\| ^4.1.8` |
| `tailwindcss` | 4.3.3 | |
| Node | 26.x | |
| Go | 1.26 | |

## Security overrides (2026-08-13)

`pnpm audit` flagged four high-severity findings, all reachable only through `next@16.2.12`. CI runs `pnpm audit --audit-level=high`, so these fail the build; the overrides live in `pnpm-workspace.yaml` beside the pins above.

| Package | Pin | Advisory | Peer-range check |
|---|---|---|---|
| `sharp` | 0.35.0 | libvips CVEs (GHSA-f88m-g3jw-g9cj) | next declares optional `^0.34.5`; sharp is loaded lazily by `next/image` through a stable API, 0.35.0 is the line Next itself moved to. Verified by build + a native resize smoke test. |
| `postcss` | 8.5.25 | sourceMappingURL reads (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849) | next bundled 8.4.31; 8.5.x is the same major line. Verified by a full production build. |
| `nanoid` | 3.3.17 | GHSA-2v37-7h3g-55p8 | inside the `^3.3.x` range postcss already declares. 3.3.18 was younger than `minimumReleaseAge` at pin time. |

Every pin is the newest patched version that also clears the 7-day `minimumReleaseAge` window.

## Consequences

**Good.** Full type-aware linting works from commit one, and the audit gate is clean.

**Cost.** We are behind latest on two packages and must track both upgrade paths. Both are recorded in `.raven/manifest.json` under `stack.pinned_reasons`, so the reason survives after everyone has forgotten it.

**Rule.** Neither pin may be raised without re-checking the peer range that caused it. A green `pnpm install` with `--force` is not evidence.
