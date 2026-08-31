# ADR-0011 — The studio is its own deployment

- **Status:** Accepted, 2026-08-13
- **Refines:** [ADR-0009](adr-0009-go-owns-the-backend.md) — the two-hexagon split
  stands. This one splits the *frontend* hexagon's driving adapter in two.

## Context

`apps/web` served two products from one deployment: the public site under
`app/[locale]/(site)/` and the editorial CMS under `app/[locale]/studio/`.

That was fine while both were being written. It stopped being fine for reasons
that are all about **release**, not about code:

1. **Blast radius.** A studio change redeploys the public site. The site is the
   product a reader sees; the studio is an internal tool used by a handful of
   people. Coupling their release cadence means the riskier, more frequently
   edited surface gates the one with an audience.
2. **Scaling and cost are opposite.** The public site is read-heavy, cacheable,
   and wants wide geographic distribution. The studio is write-heavy, entirely
   uncacheable (every route reads a session), and used from one newsroom.
3. **Exposure.** The AI endpoints, the editorial crons and the whole CMS
   surface sit behind the same origin, the same WAF rules and the same
   environment as the public site. They do not need to.
4. **Environment.** `ANTHROPIC_API_KEY`, `META_PAGE_ACCESS_TOKEN` and the RSS
   credentials are only ever used by newsroom code, but they were configured on
   the deployment that serves readers.

## Decision

Three workspaces where there was one.

```
apps/web         public site        → its own Vercel project
apps/studio      editorial CMS      → its own Vercel project, basePath /studio
packages/web-kit shared Next runtime — composition root, BFF seam, read models,
                 i18n routing, security policy, observability
packages/ui      presentational components both apps render
```

`pnpm boundaries` gains a rule — `deployables-are-independent` — that fails the
build if either app imports the other. Independence that is not enforced is a
comment.

### Why the shared code is one package, not two apps' worth of copies

The composition root wires the same graph for both: same Mongo, same use cases,
same adapters. Two copies would be two things to keep identical, and the first
time they drifted the symptom would be "publishing works in the studio but the
public page does not update" — a cache-invalidation bug three layers from its
cause. `packages/web-kit` is the composition root, and the
`composition-root-is-the-only-door` rule moved with it.

`packages/ui` is separate from `web-kit` and stays presentational: it may not
import `application`, `adapter-*` or `web-kit`. A component that needs the
container is not a shared component.

### Why the studio has a basePath

`basePath: '/studio'` means the studio's assets are served from
`/studio/_next/*`. Without it both deployments claim `/_next/*`, and mounting
the studio on the public domain via a rewrite serves one build's HTML with the
other build's JavaScript — a 404 for every chunk.

The consequence is that **the locale and the prefix swap places**: the studio's
editorial workflow screen moved from `/en/studio` to `/studio/en`. In-app links
are written prefix-free (`/review`, not `/studio/review`) because Next adds the
prefix at render time.

`/studio` is therefore written in two places — `apps/studio/next.config.ts` and
`STUDIO_BASE_PATH` in `web-kit/src/composition/origins.ts`. They are separate
builds; the second cannot read the first. `origins.test.ts` asserts the value so
a change to one fails loudly rather than 404ing in production.

## Deployment shapes

Three shapes are supported. Pick one and set the environment to match.

### 1. Same origin (default)

The studio is rewritten onto `/studio` of the public domain. Set nothing:
`APP_URL` describes both, and `siteUrl()`/`studioUrl()` derive from it.

- Session cookie is host-scoped and already reaches both. No `COOKIE_DOMAIN`.
- Needs a rewrite on the public project pointing `/studio/*` at the studio
  deployment. That rewrite needs a real hostname, so it is configured per
  environment rather than committed.

### 2. Split origin

The studio answers on its own host, e.g. `studio.kurasikapa.tv`.

| Variable | Public site | Studio |
|---|---|---|
| `APP_URL` | `https://kurasikapa.tv` | `https://studio.kurasikapa.tv` |
| `SITE_URL` | `https://kurasikapa.tv` | `https://kurasikapa.tv` |
| `STUDIO_URL` | `https://studio.kurasikapa.tv/studio` | same |
| `COOKIE_DOMAIN` | `.kurasikapa.tv` | `.kurasikapa.tv` |

`COOKIE_DOMAIN` is **required** here. Without it the site issues a host-scoped
session cookie that is never sent to the studio subdomain, so an editor signs in
successfully and the studio bounces them straight back to sign in — a loop with
no error anywhere.

`trustedOrigins` is derived from `SITE_URL` and `STUDIO_URL`, so Better Auth
accepts the cross-origin OAuth return.

### 3. Independent Vercel host

Before a custom Studio subdomain exists, the CMS may run at a provider host
such as `kurasikapa-studio.vercel.app`. That host and `kurasikapa.tv` do not
share a registrable domain, so no valid `COOKIE_DOMAIN` can make a site cookie
available to both.

In this shape the Studio owns password and second-factor session endpoints and
its sign-in page at `/studio/{locale}/sign-in`. They call the same application
use cases as the public site; only the HTTP driving adapter and host-scoped
cookies are local to the deployment.

| Variable | Public site | Studio |
|---|---|---|
| `APP_URL` | `https://kurasikapa.tv` | `https://kurasikapa-studio.vercel.app` |
| `SITE_URL` | `https://kurasikapa.tv` | `https://kurasikapa.tv` |
| `STUDIO_URL` | `https://kurasikapa-studio.vercel.app/studio` | same |
| `COOKIE_DOMAIN` | unset | unset |

## Cache invalidation across the boundary

The one thing the split genuinely broke, and the reason to read this section
before changing either app's caching.

Next scopes cache tags to a **single deployment's cache**. Every `cacheTag()` in
`web-kit/src/read-model/queries.ts` is read by `apps/web`; every publish that
invalidates one now happens in `apps/studio`. A local `updateTag()` in the
studio therefore refreshes a cache no reader ever reads, and the public article
stays stale until its `cacheLife` expires.

That fails silently in the worst way: the publish succeeds, the database is
correct, the audit log is correct, and the site does not change.

So the studio posts its tags to the site instead:

```
studio publish → event bus → collectingTags() → POST {SITE_URL}/api/revalidate
                                                 ↓ Bearer REVALIDATE_SECRET
                                            site revalidateTag(...)
```

- `REVALIDATE_SECRET` must be set to the **same value on both deployments**.
  Unset, the endpoint refuses every request (404) and the studio raises a
  failure the event bus reports. The publish itself still succeeds — the
  article really was published, and refusing to acknowledge it would tell an
  editor to publish twice.
- The receiving route uses `revalidateTag`, not `updateTag`. `updateTag` means
  "refresh within THIS request", and the request that published is on another
  machine — there is no reader here to serve. The promise degrades from "live
  within the publishing request" to "live for the next reader request", which
  is the strongest thing available once publisher and reader are separate
  deployments.
- For the same reason the wire format carries **tag names only**. The
  `update` / `revalidate` distinction `invalidateFor` makes was about
  read-your-own-writes inside one request; the receiver cannot act on it, and a
  field that is transmitted and ignored is worse than one that is absent.
- The receiver picks the `cacheLife` profile, because the receiver owns the
  `cacheTag`/`cacheLife` declarations in `read-model/queries.ts`. Where one tag
  spans several lifetimes — `article-{id}` is attached under `minutes`, `hours`
  AND `days` — it takes the **longest**. The errors are asymmetric: a marker
  that outlives its entries costs a redundant rebuild, while one that expires
  first leaves the longest-lived entry serving pre-publish text with nothing
  left to invalidate it.
- The POST is bounded by a 5s `AbortSignal.timeout`. It is awaited inside the
  publish Server Action, so an unresponsive site would otherwise hang the
  editor's publish button — turning "the site did not refresh" into
  "publishing is broken".

## Local development

`pnpm dev` runs the site on `:3000` and the studio on `:3001`. That is a
**split-origin** deployment, so `.env.example` sets `SITE_URL` and `STUDIO_URL`
rather than leaving them to the same-origin fallback — without them the
studio's sign-in handover resolves to `localhost:3000/studio`, which nothing
serves.

`COOKIE_DOMAIN` stays unset locally: cookies are scoped by host and ignore the
port, so `localhost:3000` and `localhost:3001` already share a session. That
convenience is local-only, and is exactly why production on separate hosts
needs `COOKIE_DOMAIN` set.

Note that every key in this group is `.optional()` in the schema but still
**validated when present** — `SITE_URL=` is an empty string, which fails, where
a missing line succeeds. Comment keys out rather than blanking them.

## Authentication

The studio mounts **no** Better Auth `/api/auth` routes. In the independent
Vercel-host shape it does mount the native `/api/session` password and MFA
routes because a cookie cannot cross from the public domain:

- **Reading a session** is server-side — `auth().api.getSession({ headers })`
  straight from the cookie and the shared Mongo. That is all `currentActor()`
  ever did.
- **Signing in** stays on the public site for same-parent-domain deployments.
  On an unrelated provider domain, Studio exposes password and 2FA forms backed
  by the same rate-limited use cases and credential store.
- **Signing out** is a server action in the studio calling
  `auth().api.signOut()`, which clears the cookie through the `nextCookies`
  plugin and redirects to the site.

One auth surface on the internet across two deployments, rather than two that
must be kept identical.

## Consequences

**Good.** Independent release cadence and rollback. Newsroom secrets live only
on the newsroom deployment. The public site's function bundle no longer carries
the CMS, the AI streaming code or the Anthropic SDK. The `no AI without a named
approver` rule is now also a deployment boundary, not only a code one.

**Costs.**

- Two Vercel projects to configure, and four cross-app environment variables
  that are only correct if set together. `origins.ts` centralises them and
  fails toward the same-origin default.
- The Playwright suite boots **both** apps, because an editorial journey starts
  at the site's sign-in and ends in the studio. That handover is the thing most
  likely to break, so testing it is the point. It is a test-time coupling only —
  neither `next build` needs the other.
- A reader who signs in is still sent to the studio and bounced home if they
  cannot draft. That was true before the split; it is now a cross-deployment
  round trip. Fixing it needs a signed or allowlisted destination on the sign-in
  page — deliberately **not** done here, because taking the destination from the
  query string is how that form becomes an open redirect.

## Alternatives rejected

**Leave it as one app.** Cheapest, and it is what was there. It fails every
reason in the Context; the client asked for separable deployment specifically.

**Two apps, no shared package — duplicate the composition root.** Avoids a new
package. Guarantees drift in the one file where drift is most expensive, and
`pnpm dup` would flag it.

**Keep `/en/studio` and rewrite per locale.** Preserves every existing URL and
e2e path. Breaks static assets (both apps serve `/_next/*`), and needs one
rewrite rule per locale which then collides with the public `[locale]`
catch-all. The URL churn was the cheaper cost.
