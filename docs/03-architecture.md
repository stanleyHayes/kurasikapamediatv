# 03 — Architecture

**Style:** Hexagonal (Ports & Adapters), one domain model, two deployable hexagons.
**Rule that governs everything below:** dependencies point *inward*. The domain knows nothing about Next.js, MongoDB, Anthropic, Mux, Stripe or HTTP.

---

## 1. Deployment topology

```
                    ┌─────────────────────────┐
   readers ────────▶│  Vercel — apps/web      │
   editors  ───────▶│  Next.js 16 (RSC/PPR)   │
                    └───────────┬─────────────┘
                                │ ports
                    ┌───────────▼─────────────┐
                    │  MongoDB Atlas          │
                    │  + Atlas Search         │
                    │  + Atlas Vector Search  │
                    └───────────▲─────────────┘
                                │ ports
                    ┌───────────┴─────────────┐
                                │ HTTP / JSON
                    ┌───────────▼─────────────┐
                    │  Render — services/api  │
   cron     ───────▶│  Go 1.26                │
                    │  domain + use cases     │
                    └───────────┬─────────────┘
                                │ ports
                    ┌───────────▼─────────────┐
                    │  MongoDB Atlas          │
                    │  + Atlas Search         │
                    │  + Atlas Vector Search  │
                    └─────────────────────────┘
```

**Line of responsibility.** Next.js owns rendering and the browser session;
every business decision lives in Go. Public-site reads are cached on Vercel and
revalidated from the BFF seam; CMS writes and cron endpoints call the Go API.

| Concern | Home | Why |
|---|---|---|
| Public pages, article reads, search UI | `apps/web` | Cache Components make these near-static |
| Editorial CMS, auth, RBAC, drafts | `apps/web` | Renders UI; rules enforced by `services/api` |
| Interactive AI (rewrite, headline, SEO) | `apps/web` | RSC streams to the editor, sub-30s |
| Published-inventory SEO audit | `services/api` | Go joins public articles, approved revisions and published staff profiles; Studio only renders the report |
| CMS writes, publish, schedule, transitions | `services/api` | Authorisation lives in the domain |
| Social fan-out, scheduled publishing | `services/api` | Retryable queue work, not request-scoped |
| RSS ingest, sitemap generation, digests | `services/api` | Cron-driven |
| Live TV, VOD, transcode orchestration | `services/api` | Long-lived, Amazon IVS + Cloudinary (R3) |
| Article narration jobs | `services/api` | Async Polly/S3 generation, editor approval, Cloudinary delivery |
| Events and summits | `services/api` | Publish windows, imagery, registration and upcoming-event projection stay provider-neutral |

Live channels are provisioned only when an Amazon IVS recording configuration
is present, so every broadcast is captured to the station's private S3
destination. Provisioning also requires an operator-confirmed in-band caption
source. That readiness mode is stored and projected publicly; the HLS player
enables its CC control only when the delivered manifest exposes a real caption
or subtitle track. Legacy broadcasts remain explicitly `unverified` rather
than inheriting a false accessibility claim. Recording capture does not make a replay public. After the
recording is verified in the media library, Go lists only ended live schedule
slots awaiting a replay and requires a ready Cloudinary video plus ready WebVTT
captions before completing the slot. Public guide reads then project the video
through `VideoDeliveryPort` into adaptive HLS, poster and caption URLs.

Recording promotion is asynchronous and Go-owned. EventBridge sends a signed
IVS `Recording End` event to the API; the application stores a source-session
idempotency record before MediaConvert packages the discovered private HLS as
MP4. A cron poll promotes completed output from an allowlisted private S3
bucket into Cloudinary, persists a ready video asset, then removes only the
temporary MP4. The original IVS capture remains under its recovery lifecycle.

---

## 2. Repository layout

```
packages/
  domain/              pure TypeScript. Entities, value objects, invariants. ZERO runtime deps.
  application/         use cases + PORT interfaces. Imports domain only.
  adapter-mongo/       ArticleRepository, UserRepository, … implements outbound ports
  adapter-anthropic/   AiPort
  adapter-mux/         StreamPort
  adapter-storage/     AssetStoragePort
  adapter-social/      SocialPublishPort
  adapter-payments/    PaymentPort
  adapter-search/      SearchPort, VectorSearchPort
  adapter-email/       EmailPort
  adapter-push/        PushPort
  adapter-rss/         RssFeedPort
  adapter-media-svc/   MediaJobPort — HTTP client for the Go service
  ui/                  design system ("Regal Precision") — presentational only
  config/              shared eslint / tsconfig / vitest / dependency-cruiser presets

apps/web/
  app/                 Next.js routes = DRIVING adapters. Thin. No business logic.
  src/composition/     the ONLY place adapters may be imported. Builds the use-case registry.

services/api/
  cmd/api/             main.go — HTTP + composition root
  internal/domain/     Go entities and invariants. stdlib only (x/text for NFC).
  internal/app/        use cases + port interfaces
  internal/adapter/    mongo, anthropic, cloudinary, resend, ivs
```

Article narration follows the same inward dependency flow: Studio requests a
job for the exact approved revision; the Go application calls a provider port;
AWS Polly writes privately to a same-region S3 staging bucket; the adapter
promotes a completed MP3 to Cloudinary and removes the staging object. The
recording stays private until an editor with `article:publish` explicitly
attaches it. Public reads expose only that immutable approved snapshot.

### The dependency rule, as code

`dependency-cruiser` fails CI on any violation:

| From | May import | Must never import |
|---|---|---|
| `packages/domain` | *(nothing)* | everything |
| `packages/application` | `domain` | any `adapter-*`, `next`, `mongodb` |
| `packages/adapter-*` | `application`, `domain` | another `adapter-*`, `apps/*` |
| `apps/*/app/**` | `web-kit`, `application`, `domain`, `ui` | any `adapter-*`, the other app |
| `packages/ui` | *(react only)* | `application`, `adapter-*`, `web-kit` |
| `packages/web-kit/src/composition/**` | everything | — |

That last row is the escape hatch, and it is deliberately one directory. If a route handler wants Mongo, it has to go through a use case. There is no second way in.

---

## 3. Bounded contexts

Seven contexts, each a folder inside `packages/domain`. They share IDs, never internals.

| Context | Owns | Key invariants |
|---|---|---|
| **editorial** | Article, Revision, Category, Tag, Byline | An Article cannot reach `Published` without an approved Revision and a locale-complete `Slug` |
| **identity** | User, Role, Permission, Session, StaffProfile | 11 roles resolve to a permission set; public newsroom identities require an approved biography and verified portrait |
| **media** | Asset, LiveStream, Podcast, Episode | An Asset is immutable once referenced by a published Article |
| **distribution** | SocialPost, Newsletter, PushAlert, RssSource | A SocialPost may only reference a `Published` Article |
| **audience** | Reader, Bookmark, ReadingHistory, Comment | A Comment belongs to exactly one Article and one Reader |
| **revenue** | AdCampaign, Placement, Subscription, Donation | Premium content resolves entitlement in the domain, not the UI |
| **insight** | PageView, SeoReport, RevenueSnapshot | Append-only. No updates, ever. |

---

## 4. Why two hexagons and not one

The Go service is a **separate hexagon**, not a shared library. It owns the
editorial domain today and will host each bounded context as it is ported from
TypeScript. The TypeScript side keeps the BFF seam in `packages/web-kit/src/bff/`, but
business rules are enforced in Go, not in Next.js.

This is deliberate: a shared cross-language domain model is a fiction that costs
more than it saves. During migration the two implementations must not both serve
production; a context is cut over only when its Go use cases pass the ported
tests and the web app calls them.

---

## 5. Caching strategy (Next.js 16 Cache Components)

`cacheComponents: true`. Three tiers per page:

- **Static shell** — chrome, nav, footer. Prerendered.
- **`use cache` + `cacheTag`** — article bodies, category lists, homepage rails. Tagged `article-{id}`, `category-{slug}`, `homepage`.
- **`<Suspense>`** — reader session, bookmarks, live viewer counts, premium entitlement.

Publishing an article calls `updateTag('article-{id}')` and `revalidateTag('homepage')` from the Server Action. Breaking news is therefore live within one request, not one revalidation window.

`use cache` may never contain `cookies()`, `headers()` or `searchParams`. Reader-specific values are extracted in the dynamic shell and passed as arguments.

### Known limitation: soft 404s

Cache Components flushes the prerendered shell before a Suspense child can call `notFound()`, so a missing article answers **200 with not-found markup**, not 404. Both escapes fail: `connection()` does not stop the prerender pass, and `export const dynamic` is rejected outright as incompatible with `cacheComponents`.

The harm from a soft 404 is crawlers indexing "not found" pages, so that is defended directly:

- `app/[locale]/not-found.tsx` declares `robots: { index: false, follow: false }`, so **every** not-found response is noindex whatever route produced it.
- The sitemap never advertises a URL that does not resolve.
- E2E journeys assert both, so the mitigation cannot quietly stop working.

Revisit when Next offers a per-route prerender opt-out that coexists with Cache Components. Found by the Playwright journeys, not by reasoning — which is the argument for having them.

---

## 6. Internationalisation

`next-intl` with `/[locale]/…` routing. Locales are **data**, not code: `en`, `fr` at launch, plus a configurable list for local languages.

Translation is modelled at the document level (`ArticleTranslation`), not the field level — a French article is an editorial artefact with its own byline, slug, SEO metadata and publish state, and may be published independently of the English original.

---

## 7. Related

- Port contracts → [05-ports.md](05-ports.md)
- Collections and indexes → [04-data-model.md](04-data-model.md)
- Decision records → [decisions/](decisions/)
