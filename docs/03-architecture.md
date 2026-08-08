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
   webhooks ───────▶│  Render — media-svc     │──▶ Mux (live/VOD)
   cron     ───────▶│  Go 1.26                │──▶ Meta Graph API
                    └─────────────────────────┘──▶ Anthropic (batch)
```

**Line of responsibility.** Anything a reader waits on runs on Vercel. Anything slow, scheduled, streaming, or fan-out runs in Go on Render.

| Concern | Home | Why |
|---|---|---|
| Public pages, article reads, search UI | `apps/web` | Cache Components make these near-static |
| Editorial CMS, auth, RBAC, drafts | `apps/web` | Interactive, session-bound, short requests |
| Interactive AI (rewrite, headline, SEO) | `apps/web` | Streams to the editor, sub-30s |
| Live TV, VOD, transcode orchestration | `media-svc` | Long-lived, Mux webhook consumer |
| Social fan-out, scheduled publishing | `media-svc` | Retryable queue work, not request-scoped |
| Bulk AI (translate archive, re-tag, TTS) | `media-svc` | Minutes-to-hours, must survive redeploys |
| RSS ingest, sitemap generation, digests | `media-svc` | Cron-driven |

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
  adapter-media-svc/   MediaJobPort — HTTP client for the Go service
  ui/                  design system ("Regal Precision") — presentational only
  config/              shared eslint / tsconfig / vitest / dependency-cruiser presets

apps/web/
  app/                 Next.js routes = DRIVING adapters. Thin. No business logic.
  src/composition/     the ONLY place adapters may be imported. Builds the use-case registry.

services/media-svc/
  cmd/server/          main.go — HTTP + worker entrypoint
  internal/domain/     Go mirror of the shared vocabulary (media + distribution contexts)
  internal/app/        use cases + port interfaces
  internal/adapters/   mongo, mux, meta, anthropic, s3
```

### The dependency rule, as code

`dependency-cruiser` fails CI on any violation:

| From | May import | Must never import |
|---|---|---|
| `packages/domain` | *(nothing)* | everything |
| `packages/application` | `domain` | any `adapter-*`, `next`, `mongodb` |
| `packages/adapter-*` | `application`, `domain` | another `adapter-*`, `apps/*` |
| `apps/web/app/**` | `application`, `domain`, `ui` | any `adapter-*` |
| `apps/web/src/composition/**` | everything | — |

That last row is the escape hatch, and it is deliberately one directory. If a route handler wants Mongo, it has to go through a use case. There is no second way in.

---

## 3. Bounded contexts

Seven contexts, each a folder inside `packages/domain`. They share IDs, never internals.

| Context | Owns | Key invariants |
|---|---|---|
| **editorial** | Article, Revision, Category, Tag, Byline | An Article cannot reach `Published` without an approved Revision and a locale-complete `Slug` |
| **identity** | User, Role, Permission, Session | 11 roles resolve to a permission set; permission checks live in the domain, never in a route |
| **media** | Asset, LiveStream, Podcast, Episode | An Asset is immutable once referenced by a published Article |
| **distribution** | SocialPost, Newsletter, PushAlert, RssSource | A SocialPost may only reference a `Published` Article |
| **audience** | Reader, Bookmark, ReadingHistory, Comment | A Comment belongs to exactly one Article and one Reader |
| **revenue** | AdCampaign, Placement, Subscription, Donation | Premium content resolves entitlement in the domain, not the UI |
| **insight** | PageView, SeoReport, RevenueSnapshot | Append-only. No updates, ever. |

---

## 4. Why two hexagons and not one

The Go service is a **separate hexagon**, not a shared library. It has its own domain package covering only `media` and `distribution`. The two communicate over an explicit HTTP contract behind `MediaJobPort`.

This is deliberate: a shared cross-language domain model is a fiction that costs more than it saves. What we share is the *contract*, generated from one OpenAPI document into both a TypeScript client and Go server stubs.

---

## 5. Caching strategy (Next.js 16 Cache Components)

`cacheComponents: true`. Three tiers per page:

- **Static shell** — chrome, nav, footer. Prerendered.
- **`use cache` + `cacheTag`** — article bodies, category lists, homepage rails. Tagged `article-{id}`, `category-{slug}`, `homepage`.
- **`<Suspense>`** — reader session, bookmarks, live viewer counts, premium entitlement.

Publishing an article calls `updateTag('article-{id}')` and `revalidateTag('homepage')` from the Server Action. Breaking news is therefore live within one request, not one revalidation window.

`use cache` may never contain `cookies()`, `headers()` or `searchParams`. Reader-specific values are extracted in the dynamic shell and passed as arguments.

---

## 6. Internationalisation

`next-intl` with `/[locale]/…` routing. Locales are **data**, not code: `en`, `fr` at launch, plus a configurable list for local languages.

Translation is modelled at the document level (`ArticleTranslation`), not the field level — a French article is an editorial artefact with its own byline, slug, SEO metadata and publish state, and may be published independently of the English original.

---

## 7. Related

- Port contracts → [05-ports.md](05-ports.md)
- Collections and indexes → [04-data-model.md](04-data-model.md)
- Decision records → [decisions/](decisions/)
