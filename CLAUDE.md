# CLAUDE.md — Kurasikapa Media TV

> **Read [AGENTS.md](AGENTS.md) first.** It holds the engineering rules — the dependency rule, size limits, testing discipline and Definition of Done. This file covers what is specific to working here with Claude Code.

## What this is

An AI-native publishing platform for a France-registered television, radio and online media house. Two deployable hexagons sharing one MongoDB Atlas cluster:

- `apps/web` — Next.js 16 on Vercel. Public site + editorial CMS.
- `services/media-svc` — Go 1.26 on Render. Streaming, queues, batch AI, cron.

Full scope is ~200 features across five releases. Currently in **R1 — Foundation & Publishing**.

## Commands

```bash
pnpm dev              # web + media-svc + local Mongo replica set
pnpm test             # vitest, all workspaces
pnpm test:watch       # TDD loop
pnpm lint             # eslint, type-aware
pnpm typecheck        # tsc --noEmit
pnpm boundaries       # dependency-cruiser — the hexagon rule
pnpm dup              # jscpd duplication check
pnpm verify           # everything above, in the order CI runs it
pnpm test:e2e         # playwright
```

`pnpm verify` is the gate. Run it before saying a task is done.

## Where things go

| You are writing | It goes in | It may import |
|---|---|---|
| A business rule or invariant | `packages/domain/<context>/` | nothing |
| Orchestration across repositories | `packages/application/<context>/` | domain |
| A port interface | `packages/application/src/ports/` | domain |
| Anything touching MongoDB, Anthropic, Mux, Stripe | `packages/adapter-*/` | application, domain |
| A page, route handler or Server Action | `apps/web/app/` | application, domain, ui |
| Adapter wiring | `apps/web/src/composition/` | everything |
| A presentational component | `packages/ui/` | nothing app-specific |

Seven bounded contexts: `editorial` · `identity` · `media` · `distribution` · `audience` · `revenue` · `insight`.

## Design system

The UI is already designed — ~70 screens in `stitch_kurasikapa_ai_media_platform.zip`, design system **"Regal Precision"**: Playfair Display for headlines, Outfit for body and UI, navy `#131b2e` primary with champagne `#775a19` accent, 8px base spacing, 1280px container, light and dark themes.

Implement against those designs. Do not invent new visual direction.

## Next.js specifics

`cacheComponents: true` is on. Three tiers per page:

- Static shell — chrome, nav, footer.
- `'use cache'` + `cacheTag('article-{id}')` — article bodies, category lists, homepage rails.
- `<Suspense>` — session, bookmarks, entitlement, live viewer counts.

`cookies()`, `headers()` and `searchParams` may **never** appear inside `'use cache'`. Read them in the dynamic shell and pass them as arguments.

Publishing calls `updateTag('article-{id}')` and `revalidateTag('homepage')` from the Server Action, so breaking news is live within the request.

## Version pins that will bite you

| Package | Pinned | Why |
|---|---|---|
| `typescript` | 5.9.3 | `typescript-eslint@8` peers `<6.1.0`. TS 7 kills type-aware linting. |
| `mongodb` | 6.21.0 | `@auth/mongodb-adapter@3` peers `^6`. v7 breaks Auth.js. |

Do not "upgrade to latest". Check the peer range first — [ADR-0007](docs/decisions/adr-0007-toolchain-pins.md).

## Product rules that are not negotiable

1. **No AI output is persisted or published without a named human approver.** Every `AiPort` method returns a proposal. This is an editorial-integrity requirement, not a UX preference.
2. **Authorisation lives in the domain.** Auth.js says who someone is; `packages/domain/identity` decides what they may do. A UI role check is cosmetic and is never the control.
3. **Locale is data.** A French article is its own document with its own slug, byline and publish state — not a field on the English one.
4. **Audit and insight collections are append-only.** No updates, no deletes.

## Local MongoDB

Transactions require a replica set. `pnpm dev` starts a **single-node replica set**, not a standalone `mongod`. A standalone will pass most tests and then fail on publish.

## Open questions for the client

Tracked in [docs/01-brd.md § 6](docs/01-brd.md#6-not-yet-answered). If a task depends on one of them, say so rather than guessing.
