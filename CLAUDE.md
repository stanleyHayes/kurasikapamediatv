# CLAUDE.md — Kurasikapa Media TV

> **Read [AGENTS.md](AGENTS.md) first.** It holds the engineering rules — the dependency rule, size limits, testing discipline and Definition of Done. This file covers what is specific to working here with Claude Code.

## What this is

An AI-native publishing platform for a France-registered television, radio and online media house. Three deployables sharing one MongoDB Atlas cluster:

- `apps/web` — Next.js 16 on Vercel. The public site.
- `apps/studio` — Next.js 16 on Vercel, `basePath: /studio`. The editorial CMS.
- `services/api` — Go 1.26 on Render. Domain, use cases, adapters, HTTP/JSON API.

The two Next apps ship independently — see [ADR-0011](docs/decisions/adr-0011-studio-is-its-own-deployment.md)
for why, and for the two supported URL/cookie shapes. They share
`packages/web-kit` (composition root, BFF seam, read models, i18n, security)
and `packages/ui` (presentational components). `pnpm boundaries` fails if
either app imports the other.

Full scope is ~200 features across five releases. Currently in **R1 — Foundation & Publishing**.

## Commands

```bash
pnpm dev              # web on :3000 and studio on :3001, in parallel
                      # (Mongo and the Go api are separate processes — see below)
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
| Anything touching MongoDB, Anthropic, Cloudinary, Stripe | `packages/adapter-*/` | application, domain |
| A Go business rule or invariant | `services/api/internal/domain/<context>/` | stdlib only |
| A Go use case or port | `services/api/internal/app/<context>/` | internal/domain |
| A Go adapter | `services/api/internal/adapter/<tech>/` | internal/app |
| A reader-facing page, route or Server Action | `apps/web/app/` | web-kit, application, domain, ui |
| A newsroom page, route or Server Action | `apps/studio/app/` | web-kit, application, domain, ui |
| Adapter wiring | `packages/web-kit/src/composition/` | everything |
| BFF seam to the Go API | `packages/web-kit/src/bff/` | application, domain |
| A read model / view mapper | `packages/web-kit/src/read-model/` | application, domain |
| A component **both** apps render | `packages/ui/src/` | react only |

Anything shared between the two apps goes in a package, never imported across
`apps/*` — `pnpm boundaries` fails the build on that. When in doubt, duplicate:
a premature shared component re-couples two deployments that were deliberately
separated. See [ADR-0011](docs/decisions/adr-0011-studio-is-its-own-deployment.md).

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

### The rule that has bitten us three times

**Any request-scoped read belongs INSIDE a `<Suspense>` boundary, never above one.** That includes `await params` on a dynamic segment, `cookies()`, `headers()`, and anything that reads the session.

Reading above the boundary blocks the prerendered shell, and the build fails with *"Uncached data was accessed outside of `<Suspense>`"*. It has caught us on the article page (`await params` for `[slug]`), the studio layout (session), and would have shipped as "the site feels slow" if the build were not a gate.

The shape that works — pass the promise down rather than awaiting it:

```tsx
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Body params={params} />   {/* awaits inside */}
    </Suspense>
  )
}
```

For a layout guarding its children, wrap `children` rather than running the check above them. A Server Component's children are elements, not results, so the page below only executes once the guard admits it.

Also: reading the clock (`new Date()`) in a Server Component is a prerender error for the same reason — a prerendered page has no "now". Put it behind `'use cache'` with a `cacheLife`, as `SiteFooter` does.

Publishing calls `updateTag('article-{id}')` and `revalidateTag('homepage')` from the Server Action, so breaking news is live within the request.

## Version pins that will bite you

| Package | Pinned | Why |
|---|---|---|
| `typescript` | 5.9.3 | `typescript-eslint@8` peers `<6.1.0`. TS 7 kills type-aware linting. |
| `mongodb` | 6.21.0 | Deliberate, not forced. adapter-mongo is written against v6. |

Do not "upgrade to latest". Check the peer range first — [ADR-0007](docs/decisions/adr-0007-toolchain-pins.md).

## Product rules that are not negotiable

1. **No AI output is persisted or published without a named human approver.** Every `AiPort` method returns a proposal. This is an editorial-integrity requirement, not a UX preference.
2. **Authorisation lives in the domain.** Better Auth says who someone is; `packages/domain/identity` decides what they may do. A UI role check is cosmetic and is never the control. Roles are read on every request, never carried in the session token, so a revocation lands immediately.
3. **Locale is data.** A French article is its own document with its own slug, byline and publish state — not a field on the English one.
4. **Audit and insight collections are append-only.** No updates, no deletes.

## Local MongoDB

Transactions require a replica set. Run a **single-node replica set**, not a
standalone `mongod` — a standalone passes most tests and then fails on publish.
`pnpm dev` does not start it; bring it up yourself and point `MONGODB_URI` at it.

## Running both apps locally

`pnpm dev` starts the public site on `:3000` and the studio on `:3001`. The
studio's basePath is part of its URL, so it answers at
`http://localhost:3001/studio/en`, not `http://localhost:3001/en`.

Cookies are scoped by host and ignore the port, so a session created on
`localhost:3000` reaches `localhost:3001` and sign-in works across the two
without any extra configuration. That convenience does **not** exist in
production on separate hosts — that is what `COOKIE_DOMAIN` is for. See
[ADR-0011](docs/decisions/adr-0011-studio-is-its-own-deployment.md) § Deployment shapes.

## Open questions for the client

Tracked in [docs/01-brd.md § 6](docs/01-brd.md#6-not-yet-answered). If a task depends on one of them, say so rather than guessing.
