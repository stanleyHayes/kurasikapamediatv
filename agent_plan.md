# agent_plan.md — what is built, what is available, what is next

> **Status doc, not a design doc.** Every claim here was verified against the
> repository on 2026-08-09 at `3bebf4a`. Where something is *not* built, it says
> so plainly. Where something is built but unreachable from the UI, it says that
> too — that distinction is the point of this file.
>
> Read [AGENTS.md](AGENTS.md) for the engineering rules and
> [CLAUDE.md](CLAUDE.md) for what is specific to working here. This file tells
> you *where the work is*; those two tell you *how to do it*.

---

## 1. At a glance

| | |
|---|---|
| Release in progress | **R1 — Foundation & Publishing** (near complete), first R2 slices landed |
| Backend language | **Go** — see [ADR-0009](docs/decisions/adr-0009-go-owns-the-backend.md). Migration just started. |
| HEAD | `feature/KUR-65-split-studio-deployable` — the studio split, branched off `ecdd55e` (KUR-64) |
| Commits | 65 (`KUR-1` … `KUR-65`) |
| Unit tests (TS) | 912 passing — domain 233 · application 271 · adapter-mongo 115 · adapter-anthropic 28 · web 265 |
| Unit tests (Go) | `services/api` — editorial domain + app + HTTP, 97.3% domain / 90.2% app |
| E2E | 25 Playwright journeys + 4 axe WCAG 2.2 AA checks, all passing |
| Gates | `lint` 0 · `typecheck` 0 · `boundaries` 0 · `jscpd` 0.22% · `next build` 0 · `go vet`/`gofmt`/`go test -race` 0 |
| Deployables | **Three:** `apps/web` (public), `apps/studio` (CMS, basePath `/studio`), `services/api` (Go). See [ADR-0011](docs/decisions/adr-0011-studio-is-its-own-deployment.md). |
| Deployed | **No.** Nothing is on Vercel or Render yet. Local only. |

Run `pnpm verify` before claiming any task is done. It runs the gates in CI order.

---

## 2. The shape of the system

Three deployables over one MongoDB cluster.

**The studio ships separately from the public site** —
[ADR-0011](docs/decisions/adr-0011-studio-is-its-own-deployment.md). `apps/web`
serves readers; `apps/studio` serves the newsroom at basePath `/studio`. They
share `packages/web-kit` (composition root, BFF seam, read models, i18n
routing, security policy) and `packages/ui` (presentational components), and
`pnpm boundaries` fails if either app imports the other.

Two consequences worth knowing before touching either app:

- The studio's URLs are `/studio/{locale}/...`, not `/{locale}/studio/...` —
  the basePath comes first. In-app links are written prefix-free.
- Cache tags are per-deployment, so a publish in the studio posts its
  invalidations to the site's `/api/revalidate` rather than calling
  `updateTag` locally. `REVALIDATE_SECRET` must be set on both.

**The backend is moving to Go.** [ADR-0009](docs/decisions/adr-0009-go-owns-the-backend.md)
supersedes the old split: all business logic goes to `services/api`, and Next.js
becomes the frontend plus a session and a BFF seam.

```
services/api/internal/domain     Go — zero deps (one exception: x/text for NFC)
services/api/internal/app        Go — use cases + ports
services/api/internal/adapter/*  Go — mongo, anthropic, cloudinary, resend, ivs
services/api/cmd/api             Go — composition root + HTTP

apps/web                 Next.js 16 — rendering, Better Auth cookie, BFF
packages/ui              presentational components
```

**Still TypeScript, being migrated per bounded context — not deleted yet:**

```
packages/domain          the rules, in TS. Ported to Go context by context.
packages/application     use cases, in TS.
packages/adapter-mongo   MongoDB repositories, in TS.
packages/adapter-anthropic  AiPort, in TS.
```

Two live implementations of the same rules is the thing to avoid, so a context
is cut over only when its Go use cases pass the ported tests AND the web app
calls them. `editorial` first, since it is the whole of R1.

`packages/web-kit/src/composition/` is the only place allowed to import an `adapter-*`.
dependency-cruiser enforces this; the rule is `composition-root-is-the-only-door`
and it has been probe-tested.

Seven bounded contexts: `editorial` · `identity` · `media` · `distribution` ·
`audience` · `revenue` · `insight`. Four exist in TypeScript; `media`,
`revenue` and `insight` are named in the architecture but have no files in
either language.

**Go migration progress:** domain, application ports, editorial use cases, the
MongoDB adapter, the HTTP layer and the composition root are done
(KUR-29 … KUR-43). **The service runs** — verified against real MongoDB:
`/healthz`, a 403 for an anonymous caller, a 201 that wrote a real article and
its revision, and the cron guard refusing a wrong secret.

Remaining for the cutover: ~~the BFF seam in Next~~ **done for CMS writes,
CMS reads, and public-site reads (KUR-45)** — when `API_URL` is set,
create/update/submit/approve/reject/schedule/publish/unpublish/restore,
get-draft, authored list, review queue, revision history, cron `publish-due`,
get-published, list-published, browse-category and list-sections call Go;
Next still owns session, cache tags and audit (Go's bus only logs). Unset
`API_URL` keeps the TypeScript path. Then delete the TypeScript editorial
packages.

---

## 3. What is DONE

### 3.1 Domain (`packages/domain`)

| Context | Files | Holds |
|---|---|---|
| `editorial` | `article.ts`, `article-status.ts`, `revision.ts`, `category.ts`, `errors.ts` | Slug freezes after first publication; the Draft→Review→Approved→Scheduled→Published transition table with per-transition permissions; append-only revisions (restore writes *forward*); per-locale category slugs |
| `identity` | `actor.ts`, `role.ts`, `role-assignment.ts` | 11 roles → permission mapping; self-assignment refused even for super_admin |
| `audience` | `bookmark.ts`, `comment.ts`, `like.ts`, `reading.ts` | Refuses to save, like or record an unpublished article; comments start pending until `comment:moderate` |
| `distribution` | `social-post.ts` | Refuses unpublished articles; 5-attempt retry budget |
| `shared` | `ids.ts`, `slug.ts` | Branded ids; Unicode-aware slugs (handles Twi ɛ/ɔ) |

### 3.2 Application (`packages/application`) — 35 use cases

- **editorial (16)** — CreateDraft, UpdateDraft, GetDraft, GetPublishedArticle,
  SubmitForReview, ApproveArticle, RejectArticle, SchedulePublication,
  PublishArticle, PublishDueArticles, UnpublishArticle, ListAuthoredArticles,
  ListAwaitingReview, ListPublishedArticles, BrowseCategory, ListSections
- **identity (4)** — ResolveActor, AssignRoles, ListUsers, ResolvePublicByline
- **audience (14)** — SaveArticle, RemoveSavedArticle, ListSavedArticles, SearchArticles,
  PostComment, ModerateComment, ListVisibleComments, ListPendingComments,
  LikeArticle, UnlikeArticle, CountLikes, RecordReading, ListReadingHistory, CountReadings
- **distribution (3)** — QueueSocialPost, PublishDuePosts, ProposeSocialCaption

Ports live in `packages/application/src/ports/`. Hand-written fakes for all of
them are in `packages/application/src/testing/` — **never `vi.mock`**.

### 3.3 Adapters

| Port | Adapter | Status |
|---|---|---|
| ArticleRepository | `MongoArticleRepository` | wired — keyset pagination, never offset |
| RevisionRepository | `MongoRevisionRepository` | wired |
| CategoryRepository | `MongoCategoryRepository` | wired |
| BookmarkRepository | `MongoBookmarkRepository` | wired |
| CommentRepository | `MongoCommentRepository` | wired — public thread + `/studio/comments` |
| LikeRepository | `MongoLikeRepository` | wired — count + toggle on the article page |
| ReadingRepository | `MongoReadingRepository` | wired — recorded after the article response; count on profile |
| RoleRepository | `MongoRoleRepository` | wired |
| UserDirectory | `MongoUserDirectory` | wired — **the only file that reads Better Auth's `user` collection**; `findById` feeds public bylines |
| SearchPort | `MongoTextSearch` | wired — `$text`, *not* Atlas Search (can't run in a Testcontainer) |
| AiPort | `AnthropicAiAdapter` | wired — 12 methods, cost-routed opus/sonnet/haiku |
| SocialPostRepository | `MongoSocialPostRepository` | wired — queue UI at `/studio/social` |
| SocialPublishPort | `MetaSocialPublisher` | wired, fail-closed without `META_PAGE_ACCESS_TOKEN`; cron `/api/cron/publish-due-posts` |
| ClockPort / IdPort / EventBusPort | object literals in `composition/ambient.ts` | wired — event bus is in-process, synchronous, no delivery guarantee |

Adapter tests run against **real MongoDB via Testcontainers**, never a mocked driver.

### 3.4 Public site (`apps/web/app/[locale]/`)

`/` · `/articles/{slug}` · `/sections/{slug}` · `/search` · `/profile` ·
`/sign-in` · `/two-factor` · `/about` · `/team` · `/contact` · `/faq` · `/advertise` ·
`/careers` · `/legal/{privacy|terms|cookies}` · `/sitemap.xml` · `/robots.txt`

### 3.5 Editorial studio (`apps/studio/` — its own deployment)

`/studio` (drafts) · `/studio/articles/{id}` (editor + autosave + AI panel) ·
`/studio/review` (approval queue) · `/studio/comments` (pre-moderation queue) ·
`/studio/people` (role assignment) · `/studio/social` · `/studio/audit`

Guarded by `studio/layout.tsx`, which wraps `children` rather than checking
above them — see the Suspense rule in CLAUDE.md.

### 3.6 Server Actions (`apps/web/src/actions/`)

- `editorial.ts` — createDraft, updateDraft, submitForReview, approve, reject,
  schedule, publish, unpublish, assignRoles, toggleSaved, postComment, moderateComment
- `ai.ts` — suggestHeadlines, suggestSeo, suggestTags, summarise, factCheck,
  imagePrompt, detectCategory
- All inputs validated by Zod schemas in `schemas.ts`; all return `ActionResult`.

### 3.7 Design fidelity

The zip holds **81 screens** across desktop/tablet/mobile, light/dark and two
brand variants. All **21 base desktop screens** are extracted into
`design/screens/` — that set is the source of truth for implementation.

| Design | Route | Built to it? |
|---|---|---|
| `homepage.html` | `/` | ✅ KUR-24 |
| `kurasikapa_media_article_page` | `/articles/{slug}` | ✅ KUR-25 |
| `kurasikapa_media_category_listing` | `/sections/{slug}` | ✅ KUR-26 |
| `kurasikapa_admin_editorial_cms` | `/studio` | ✅ KUR-27 |
| `kurasikapa_admin_roles_permissions` | `/studio/people` | ✅ KUR-33 — adapted (stats + member table; invite/search/drawer omitted) |
| `kurasikapa_media_user_profile_saved_articles` | `/profile` | ✅ KUR-33 — adapted (bento + account row; membership/insights wait on R2/R4) |
| `about_us_kurasikapa_media_tv` | `/about` | ✅ KUR-42 — display hero over the client's own copy |
| `our_team_kurasikapa_media_tv` | `/team` | ◑ KUR-42 — hero done. The design's member grid needs names, roles, bios and portraits the client has **not supplied**; building it would mean inventing journalists. |
| `kurasikapa_admin_ai_content_editor` | `/studio/articles/{id}` | ✅ KUR-41 — two-pane workspace with a tabbed co-pilot |
| `social_media_publishing_kurasikapa_admin` | `/studio/social` | ✅ KUR-33 — queue + compose (calendar design not copied; send path needs Meta) |
| `user_management_kurasikapa_admin` | `/studio/people` | ✅ — **duplicate design**: same user list, role badges and status as `kurasikapa_admin_roles_permissions`. Not built twice. |
| `kurasikapa_media_podcast_library` | — | ❌ no route (R3) |
| `kurasikapa_media_live_tv_gallery` | — | ❌ no route (R3) |
| `kurasikapa_media_events_summits` | — | ❌ no route (R3) |
| `kurasikapa_admin_media_library` | — | ❌ no route (R3) |
| `kurasikapa_media_membership_donations` | — | ❌ no route (R4) |
| `support_membership_kurasikapa_media_tv` | — | ❌ no route (R4) |
| `monetization_dashboard_kurasikapa_admin` | — | ❌ no route (R4) |
| `kurasikapa_admin_subscriptions_revenue` | — | ❌ no route (R4) |
| `kurasikapa_admin_analytics_hub` | — | ❌ no route (R5) |
| `seo_center_kurasikapa_admin` | — | ❌ no route (R5) |

The full 50MB `stitch_kurasikapa_ai_media_platform.zip` is at the repo root and
is **not** in Git LFS. Design-system docs are in `design/systems/`; the chosen
one is **Regal Precision**.

---

## 4. AVAILABLE but not reachable — pick these up first

These are the cheapest wins in the repo. The capability is built and tested; only
the wiring is missing.

| Capability | Where it lives | What's missing |
|---|---|---|
| ~~`AiPort.translate()`~~ | **DONE — KUR-35.** Translate panel in the studio editor. | Needs `ANTHROPIC_API_KEY` to exercise live; unset locally. |
| ~~`AiPort.draftFromPrompt` / `draftFromBullets`~~ | **DONE — KUR-44.** Generate tab in the co-pilot; streams a proposal, editor accepts into the body. | Needs `ANTHROPIC_API_KEY` to exercise live. |
| ~~`PublishDueArticles`~~ | **DONE — KUR-34.** `/api/cron/publish-due`, triggered by Vercel Cron. | — |
| ~~**`PublishDuePosts` (social send)**~~ | **DONE.** `MetaSocialPublisher` fail-closed; cron `/api/cron/publish-due-posts`. | Live Graph still needs Meta app review + `META_PAGE_ACCESS_TOKEN` / `META_PAGE_ID`. Unset credentials fail visibly and retry. |
| ~~Revision history~~ | **DONE — KUR-36.** History panel in the studio editor, with restore. | — |
| ~~**`ListUsers` beyond roles**~~ | **DONE — KUR-59.** `findById` feeds named bylines on the article page. The people screen remains the roles directory. | — |

---

## 5. NOT built

### 5.1 R1 remainder — needed to actually close R1

| Item | State |
|---|---|
| **Deployment to Vercel + Render** | Not done. R1's exit criterion says "on production". `render.yaml` + [docs/operations/deploy-api.md](docs/operations/deploy-api.md) + `scripts/smoke-api.sh` are ready; what remains is the hosting decision itself (credentials + who owns the Render/Vercel accounts). |
| **The Go backend itself** | Domain → HTTP serving done (KUR-29 … KUR-43). Editorial BFF cutover done (KUR-45) for CMS writes/reads and public-site reads when `API_URL` is set. Remaining: delete TS editorial packages once a deployed API is the only live path. |
| ~~Audit logs~~ | **DONE — KUR-38.** Every domain event is recorded. Append-only enforced by the port having no update or delete, and tested against a real database. Screen at `/studio/audit`, gated on `audit:read`. |
| ~~**Rich-text editor**~~ | **DONE.** Textarea + Markdown toolbar (bold/italic/heading/link). `ArticleBody` parses a safe subset into React children — still no HTML, still no sanitiser dependency. |
| ~~Security headers~~ | **DONE — KUR-37.** CSP and Permissions-Policy added; the rest were already in next.config.ts (my earlier note checked proxy.ts and was wrong). Applied to every route including /api. |
| ~~Rate limiting~~ | **DONE — KUR-39.** AI endpoints limited via a shared MongoDB counter (fails closed). Auth limited by Better Auth's own limiter, moved to database storage — its in-memory default is per-instance and limits nothing on serverless. Search limited too (fails open — it is the least valuable thing to protect and the most visible to break). |
| ~~**2FA**~~ | **DONE.** Better Auth `twoFactor` plugin; verify page at `/[locale]/two-factor`; enable UI on the profile Security card. |
| ~~**CAPTCHA**~~ | **DONE.** Cloudflare Turnstile, env-gated. Unset keys leave sign-in alone (Playwright still works). |
| ~~**Google Analytics**~~ | **DONE.** gtag loads only after the consent banner; unset `NEXT_PUBLIC_GA_MEASUREMENT_ID` renders nothing. Search Console still needs the client property. |
| **Scheduling actually firing** | Article cron live (KUR-34). Social cron live and fail-closed until Meta credentials exist. |
| ~~**Remaining designed screens**~~ | **DONE** for every route that exists — all ten built routes match their supplied designs (§3.7). `/team` stays ◑ until the client supplies names/roles/bios/portraits; the R3–R5 screens have no routes yet. |
| ~~**Error tracking**~~ | **DONE.** Locale + global error boundaries; failures go to stderr via `reportError`. A Sentry DSN is still a hosting choice — the boundary no longer swallows. Backups remain Atlas/ops, not code. |
| **RSS out** | **DONE.** `/{locale}/feed.xml` from the published list. RSS ingest is live (KUR-55) as drafts via Next cron. |

### 5.2 R2 — Audience & Distribution

Domain for saved articles, comments and social posts exists (§3). Comments are
pre-moderated: a reader post stays pending until an editor with `comment:moderate`
approves it. Likes and reading history are live — profile shows the saved library, a read
count, and a **Recently read** trail from `ListReadingHistory` (KUR-58). Newsletter **double opt-in is live
and fail-closed** (KUR-50): subscribe at `/[locale]/newsletter`, confirm link,
unsubscribe; Resend unset → `EmailDeliveryFailed`, nothing mailed. **Digests are
live and fail-closed (KUR-56):** daily/weekly cron mails confirmed subscribers
stories from the window; empty windows latch so quiet days do not retry;
unset Resend fails closed. **PWA offline reading is live (KUR-51):** installable
manifest, production service worker, network-first cache of visited articles /
sections / home. Studio, auth, profile and RSC flights stay on the network.
Remaining open: Facebook + Instagram **send** (adapter + cron wired; Meta app review
and tokens still blocked), semantic related / recommended (needs
`EmbeddingPort` — **declared, no adapter**, and Atlas Vector Search).
**AI social captions are live (KUR-60):** `ProposeSocialCaption` loads the
approved body and returns a caption + hashtags proposal into the compose
form — nothing is queued until an editor schedules. **Category-based related is live (KUR-57):** same-section siblings on the
article page; empty when the section has no other published stories.
**Named bylines are live (KUR-59):** the article page uses the directory
display name; missing or email-like names keep the house line, and JSON-LD
omits `author` rather than inventing a journalist. **Most-read
is live (KUR-52):** unique-reader ranking from existing reading rows; homepage
Trending Now prefers that rail and falls back to leftover recency. No embeddings.
**Breaking-news alerts are live (KUR-53):** editor click on a published article
mails confirmed subscribers in that locale; Resend unset fails closed; one blast
per article. **Web Push is live and fail-closed (KUR-54):** VAPID unset hides
the opt-in; a production service worker shows breaking notices; devices are
stored per locale and woken from the same editor click. **RSS ingest is live
(KUR-55):** editors register HTTPS feeds at `/studio/rss`; hourly cron opens
drafts from new items; fetch failures skip the source; nothing auto-publishes.
**Contact form is live and fail-closed (KUR-62):** `/[locale]/contact` mails
the newsroom via `SubmitContactMessage`; unset Resend → honest delivery
failure; rate-limited; nothing is persisted.

### 5.3 R3 — Multimedia

Nothing built. The `media` bounded context has no files in either language.
Live TV page, VOD library, video and image galleries, podcast library with
chapters and transcripts, media asset library, article-to-audio (TTS),
voice-to-article.

Providers are now settled — [ADR-0010](docs/decisions/adr-0010-media-stack.md):
**Amazon IVS** for live broadcast, real-time call-in stages and moderated chat;
**Cloudinary** for images, VOD and podcasts. Mux is superseded, unbuilt.

Four places in `apps/web` are deliberately holding space for R3 — hero images on
the homepage and briefing cards (tonal stand-ins), the article hero (omitted, not
stubbed), the "Listen" button (not rendered), and the Live indicator in the header
(present, links nowhere).

### 5.4 R4 — Revenue

Nothing built; the `revenue` context has no files. Membership tiers, paywalled
articles with domain-level entitlement, donations, Stripe (EUR) + Paystack (GHS),
ad management, AdSense, classifieds, affiliate links, advertiser portal.

### 5.5 R5 — Intelligence & Reach

Nothing built; the `insight` context has no files. AI analytics dashboard, SEO
Center, heatmaps, reader-behaviour reports, AI news anchor, AI podcast/video
generation, chatbot, public REST + GraphQL API, mobile reporter app, native apps.

---

## 6. Blocked on someone else

**Client — answers still needed** (tracked in [docs/01-brd.md § 6](docs/01-brd.md)):
domain name, launch date, budget, and which local languages beyond EN/FR.
If a task depends on one of these, say so rather than guessing.

**Client — actions:**
- **Rotate the Stitch API key.** It was pasted in plaintext into a chat session
  and is in that history. `.mcp.json` is gitignored, but the key is exposed.
- Decide on Git LFS or shared storage for the 50MB design zip.

**Client — sizing questions from [ADR-0010](docs/decisions/adr-0010-media-stack.md):**
- **Expected live audience ceiling.** Sizes the Amazon IVS quota request, which
  is a support ticket measured in days and must be filed weeks before a big
  broadcast. The default is 15,000 concurrent viewers per region.
- **Is a 720p default acceptable** for the main broadcast? Roughly halves
  delivery cost against 1080p and is kinder to West African data budgets.
- **Chat retention period**, given GDPR and the moderation requirement.

**Third-party credentials not yet available:** AWS (IVS — R3), Cloudinary (R3),
Resend (R2), Stripe + Paystack (R4), Meta Graph API and app review (R2).

---

## 7. Known limitations, accepted deliberately

- **Soft 404s.** Under `cacheComponents`, the prerendered shell flushes before a
  Suspense child can call `notFound()`, so a missing article renders not-found
  markup with HTTP 200. Both escapes fail: `connection()` doesn't stop the
  prerender pass, and `export const dynamic` is rejected outright. Mitigated with
  `robots: { index: false }` on the not-found path and sitemap exclusion.
  See [docs/03-architecture.md § 5](docs/03-architecture.md).
- **Search is `$text`, not Atlas Search.** Atlas Search can't run in a
  Testcontainer, so the adapter is written against `$text`. Swapping it is one
  file when the cluster is provisioned.
- **The event bus is in-process.** Synchronous, no delivery guarantee, no retry.
  Fine for cache invalidation; not fine for social fan-out or newsletters — those
  need `media-svc` and a real queue.
- **Placeholder legal copy is labelled as such in the UI**, on purpose. A legal
  page carrying placeholder wording without saying so is worse than one that
  admits it.

---

## 8. Working agreements for whoever picks this up

1. **`pnpm verify` is the gate.** Run it before saying a task is done.
2. **Never rebuild while a server is serving that build.** `next build` replaces
   `.next` underneath a running `next start`, and hashed CSS starts returning 500.
   Kill the server, `rm -rf .next`, rebuild, restart. This shipped as a
   user-visible "there's no CSS" bug once already.
3. **Check `BUILD EXIT: 0` before committing.** KUR-20 was committed with a
   failing build because the build and the commit ran in one shell command.
4. **Request-scoped reads belong *inside* a `<Suspense>` boundary** — `await
   params`, `cookies()`, `headers()`, session reads, `new Date()`. This has bitten
   the project three times. See CLAUDE.md.
5. **E2E runs `next build` first** (playwright.config.ts). It used to run
   `next start` against whatever was in `.next`, which meant the suite silently
   tested stale code and hid a real role-lookup defect for several commits.
6. **Better Auth stores `user._id` as an ObjectId**, while its API reports
   `user.id` as a hex string. Anything joining to that collection must convert.
   Typing it as `string` compiles fine and fails silently at runtime.
7. **No AI output is persisted or published without a named human approver.**
   Every `AiPort` method returns a proposal. Editorial-integrity requirement,
   not a UX preference.
8. **Don't "upgrade to latest".** `typescript` is pinned at 5.9.3 and `mongodb`
   at 6.21.0 — see [ADR-0007](docs/decisions/adr-0007-toolchain-pins.md).

---

## 9. Suggested next three

Ordered by value per unit of risk, not by release number.

1. **Delete TS editorial packages** once a deployed `API_URL` is the only
   live path (public-site reads are now on Go when it is set).
2. **Close R1 properly** — first deployment (Vercel + API hosting). Editor
   Markdown, 2FA, Turnstile and consent-gated GA are in; they need live env
   values and a production host.
3. **Social send path** — adapter + cron are live and fail-closed. Flip on
   when Meta app review and page tokens exist.

**Done since this file was first written:** category listing (KUR-26), editorial
CMS (KUR-27), profile/roles/social queue (KUR-33), cron publish (KUR-34),
translate (KUR-35), revision history (KUR-36), security headers (KUR-37), audit
(KUR-38), rate limits (KUR-39), AI editor shell (KUR-41), About/Team heroes
(KUR-42), Go HTTP serving (KUR-43), draft generate in the co-pilot (KUR-44),
editorial CMS BFF cutover (KUR-45: writes, restore, get-draft, lists, cron,
public reads → Go when `API_URL` is set), Markdown renderer + toolbar, 2FA,
Turnstile, consent-gated GA, fail-closed social send + cron.

---

## 10. Sweep on 2026-08-12 (through KUR-62)

### Fixed
- `packages/adapter-mongo/src/mongo-comment-repository.test.ts` — typed the
  seeded document as `CommentDocument` so `tsc --noEmit` passes.
- `.github/workflows/ci.yml` — Go job now points at `services/api` and runs
  `make verify` instead of the non-existent `services/media-svc`.
- `services/api/Dockerfile` — multi-stage distroless build added so the API can
  deploy.
- `render.yaml` — Render blueprint for the Go API: Docker runtime, `/healthz`
  health check, `MONGODB_URI` / `CRON_SECRET` left as dashboard secrets.
- `docs/operations/deploy-api.md` — step-by-step deploy, `API_URL` cut-over,
  smoke-checks, and the TS editorial deletion checklist.
- `.env.example` — removed superseded Mux keys; added ADR-0010 placeholders for
  Amazon IVS + Cloudinary; `CONTACT_TO_EMAIL` for the newsroom inbox.
- `.raven/manifest.json`, `CLAUDE.md`, `docs/03-architecture.md`,
  `docs/04-data-model.md`, `docs/01-brd.md`, `docs/06-roadmap.md`,
  `docs/07-quality-gates.md` — updated stale `services/media-svc` / Mux
  references to `services/api` + Amazon IVS + Cloudinary.
- **KUR-62** — public contact form: `SubmitContactMessage` + fail-closed Resend
  path, rate limit, standing page + form on `/contact`.
- `packages/adapter-mongo/src/indexes.ts` — newsletter token index changed from
  `sparse: true` to `partialFilterExpression: { token: { $type: 'string' } }`;
  confirmed/unsubscribed records hold `token: null`, so a sparse unique index
  still collided on `null`. This unblocks `pnpm test` for `adapter-mongo`.
- `apps/web/src/composition/` — split `build-container.ts` to remove circular
  imports and stay under the 250-line limit:
  - `container-types.ts` holds the `Container` and `Infrastructure` interfaces.
  - `editorial-queries.ts` and `distribution-commands.ts` import the types from
    `container-types.ts`, not from `build-container.ts`.
  - `build-container.ts` keeps the builder and the `editorialCommands` helper.
- `packages/adapter-mongo` — added real-Mongo tests for
  `MongoNewsletterDigestRepository`, `MongoRssSourceRepository` and
  `MongoPushSubscriptionRepository`; adapter coverage is now 95.5%.
- `apps/web/src/security/rate-limit.test.ts` — hand-written `FakeLimiter`
  tests for the login rate limiter (5 tests); web coverage is now 93.05%.
- `scripts/smoke-api.sh` — executable curl checks for the `API_URL` cut-over
  (healthz, unauthenticated write, cron wrong/right secret); referenced from
  `docs/operations/deploy-api.md` and `docs/README.md`.
- `agent_plan.md` §5.1 — fixed three stale cells: deployment now points at
  `render.yaml` + deploy doc + smoke script; "remaining designed screens"
  marked done (all ten built routes match §3.7); dropped the obsolete
  "media-svc does not exist" wording from the RSS row.
- `apps/web/e2e/contact.spec.ts` — Playwright journey for KUR-62: the form
  renders, an undeliverable message fails closed honestly (Resend unset in
  e2e), and the sixth send in a minute is rate-limited. `seed.ts` gained
  `resetRateLimits()`; `/en/contact` joined the WCAG axe sweep.
- `.dependency-cruiser.cjs` — `public/` excluded from the orphan rule;
  `pnpm boundaries` is now fully clean (the `sw.js` warning is gone).
- `apps/web/src/actions/editorial.ts` — removed the `side-actions` re-export:
  Turbopack allows only async-function exports from a `"use server"` file, so
  the re-export broke `next build` (13 errors; `pnpm verify` runs no build
  step, CI's Build gate does). The four importers now import `side-actions`
  directly.
- Coverage weak spots closed:
  - `packages/domain/src/editorial/category.test.ts` — `id`, `order` and
    `snapshot()` accessors (file now 100%; domain ring 98.8%).
  - `packages/domain/src/audience/newsletter.test.ts` — `locales` / `cadence`
    getters (file now 100%).
  - `packages/adapter-mongo/src/mongo-revision-repository.test.ts` —
    `findManyByIds` and `findLatestForArticles` (file was 50% statements, now
    100%).
  - `packages/adapter-mongo/src/mongo-article-repository.test.ts` —
    `findManyByIds` (empty + populated).
- `packages/adapter-mongo/src/indexes.ts` — the `rate_limit_ttl` TTL index moved
  here from `MongoRateLimiter.ensureIndexes`, which was dead code (nothing
  called it, so databases set up via `ensureIndexes` had an unbounded counter
  collection). The rate-limiter suite now asserts the TTL index exists.
- `services/api` — the Go API now creates every index its editorial queries
  rely on at startup, not just the revision one:
  - `internal/adapter/mongo/article_indexes.go` — `ArticleRepository
    .EnsureIndexes` with the full nine-index articles set ported from
    `packages/adapter-mongo/src/indexes.ts` (unique `locale_slug` /
    `family_locale`, listings, text search, partial `due_for_publication`).
  - `internal/adapter/mongo/category_repository.go` —
    `CategoryRepository.EnsureIndexes` (sparse unique slugs + nav order).
  - `cmd/api/main.go` — both wired fatal-on-error beside the revision call.
  - `internal/adapter/mongo/indexes_test.go` — integration tests: named
    indexes exist; duplicate `(slug, locale)` is refused by the database.
- `apps/web/e2e/prebuild-seed.ts` + `playwright.config.ts` — the recurring
  homepage flake was not a timeout: `next build` prerenders the `'use cache'`
  homepage against an EMPTY database (the seed ran only in `beforeAll`), and
  the direct-to-Mongo reseed never fires the publish-time `updateTag`, so the
  first `/en` hit served "Nothing published yet" until the cacheLife entry
  expired. The webServer command now runs the seed before the build, so the
  prerender sees the fixtures — matching production, where the database is
  never empty at deploy.
- `services/api/Makefile` — the integration hint now mentions `rs.initiate()`;
  `docs/operations/deploy-api.md` notes the API self-provisions its indexes.
- `pnpm-workspace.yaml` — security overrides after `pnpm audit` flagged 4
  high-severity findings on main: `sharp@0.35.0` (libvips CVEs; next declares
  `^0.34.5`, verified compatible), `postcss@8.5.25` (sourceMappingURL reads;
  next bundled 8.4.31), `nanoid@3.3.17` (inside postcss's existing `^3.3.x`).
  All respect `minimumReleaseAge`; `pnpm audit` is now fully clean.
- `.github/workflows/ci.yml` — the Go job gains a mongo:8 service and runs
  `make integration`, so the adapter suite (incl. the EnsureIndexes tests)
  executes in CI instead of only locally. Also removed the job-level
  `if: hashFiles(...)`: `hashFiles` is step-level only, so the whole workflow
  file failed to parse and every CI run since KUR-61 had died with zero jobs.
  `actionlint` is clean.
- `services/api` — Go test files raising app+http coverage from 90.2% to
  94.2% (floor 90%): `internal/http/handler_errors_test.go` (new; error
  branches), `internal/app/editorial/slug_guard_test.go` (new),
  `internal/app/editorial/queries_test.go` (extended), and Fail* branches in
  the `internal/app/testing` fakes. `make verify` is green: domain 97.3%,
  app 94.2%.
- `turbo.json` + `.github/workflows/ci.yml` — the Build step failed with
  `Invalid environment: MONGODB_URI, BETTER_AUTH_SECRET`: Turborepo 2.x
  defaults to strict env mode, so the step's env never reached `next build`,
  and the Build step set no `BETTER_AUTH_SECRET` at all (locally the build
  passes because a gitignored `apps/web/.env.local` supplies both). The
  `build` task now declares `passThroughEnv: [MONGODB_URI, MONGODB_DB,
  BETTER_AUTH_SECRET]` (pass-through, not `env`, so values don't churn the
  cache hash), and the CI Build step sets a 45-char dummy secret. Verified
  locally with `apps/web/.env.local` temporarily renamed: `pnpm build
  --filter=@kurasikapa/web` passes on the CI env alone.

### Green locally
- `pnpm lint` ✅
- `pnpm typecheck` ✅
- `pnpm boundaries` ✅ (fully clean — `public/` excluded from the orphan rule)
- `pnpm test` ✅ for every package, including `@kurasikapa/adapter-mongo`
  (130 tests; 100% statements/lines, 89.4% branches) and `@kurasikapa/domain`
  (98.8% statements)
- `pnpm dup` ✅ (2.54% tokens, floor 3%)
- `pnpm go:verify` ✅ (domain 97.3%, app 94.2%)
- `pnpm build` ✅ (ran via the Playwright webServer; the `use-server` re-export
  break is fixed)
- `pnpm --filter @kurasikapa/web test:e2e` ✅ — 29 journeys incl. the KUR-62
  contact form and `/en/contact` WCAG sweep
- `pnpm verify` ✅

CI is green end-to-end on `main` (run 31701435997): Quality gates (incl.
Build with the turbo `passThroughEnv` fix, 29 E2E journeys, audit), Secret
scan, and the Go service job (`make verify` + `make integration` against the
mongo:8 service). The only annotation left is an upstream Node-20 deprecation
warning on `gitleaks/gitleaks-action@v2` — not actionable from this repo.

No local blockers remain.

- `apps/web/e2e/demo-seed.ts` — expanded from 7 stories / 3 sections to a
  full demo set: 23 published stories across both locales, 7 sections, one
  article in each non-public workflow state (draft, in review, scheduled),
  and 3 visible comments on the lead story. Now runnable as
  `pnpm --filter @kurasikapa/web seed:demo` against a local Mongo
  (defaults to `127.0.0.1:37017`, overridable via `MONGODB_URI`).

## 11. PRD gap close-out on 2026-08-13 (through KUR-65)

A full audit of `docs/02-prd.md` against the code found the gaps below; each
was then built and verified.

### Built
- **Studio workflow transition UI** — the six transition Server Actions
  existed but no component called them. New `transition-controls.tsx`,
  `schedule-control.tsx` and `workflow-buttons.tsx` render only the actions
  the domain state machine + the viewer's role allow, wired into the article
  editor page; `e2e/studio.spec.ts` gained a sign-in → submit → approve →
  schedule journey.
- **Schedule publishing UI** — datetime control calling
  `schedulePublicationAction`, shown only when the domain allows scheduling.
- **AI assists completed** — rewrite + tone (new `RewritePanel` streaming tab,
  shared `use-stream-proposal.ts` core), fact-check, image-prompt and
  category-detect wired into the copilot assist panel (`assists.ts`);
  `detectCategoryAction` now loads the real sections server-side rather than
  trusting a browser-supplied list. All remain propose-then-accept (ADR-0005).
- **AI grammar check** — new `AiPort.grammarCheck` (GrammarIssue list),
  Anthropic adapter implementation (prompt, zod schema, balanced-model
  routing), `grammarCheckAction`, and a review-list UI. Never auto-applied.
- **Reader sign-up** — `/[locale]/sign-up` mirroring sign-in
  (`sign-up-form.tsx` via `authClient.signUp.email`), reciprocal links
  between the two pages.
- **News index** — `/[locale]/news`, the page breaking news lands on:
  `cachedLatest` listing (same cache tag as the homepage rails), lead story +
  grid; added to header nav, footer, sitemap, and `messages/{en,fr}.json`.
- **Social per-platform captions** — `captionForPlatform` in the domain
  (platform override wins, blank falls back to shared), `QueueSocialPost`
  fan-out, per-platform textareas in the composer, mongo round-trip test.
- **Social publish-now + short summary** — "Publish now" queues with
  `scheduledAt = now` (ClockPort at the boundary); `ProposeSocialSummary`
  use case + composer button offering the summary as an acceptable proposal.
- **Lighthouse CI** — new `lighthouse` job in `ci.yml` (mongo:8 service, seed
  → build → `treosh/lighthouse-ci-action@v12` on `/en` + an article page);
  assertions in `.github/lighthouse/lighthouserc.json`: accessibility error ≥
  0.9, performance warn ≥ 0.5 to start.
- **Axe coverage** — the WCAG sweep in `e2e/reading.spec.ts` now covers every
  journey path (10 paths).
- **Opinion/Editorial + missing categories** — `cat_entertainment`,
  `cat_lifestyle`, `cat_opinion`, `cat_editorial` join the demo seed (3
  stories each, EN+FR); `OPINION_CATEGORY_IDS` + `OpinionByline` give
  opinion/editorial articles the PRD's distinct byline treatment
  (author-forward + standing views-are-the-author's disclaimer).
- **Revision on every transition** — `RevisionTrigger` on the `Revision`
  entity (optional for legacy documents, required at mint); all six
  transition use cases append a snapshot revision via the shared
  `mintTransitionRevision` helper; approve's pinned-revision mechanism is
  untouched. Composition wiring updated to pass `revisions` + `ids`.
- **Demo seed** — now 35 published stories, 11 sections, 3 comments, one of
  each non-public workflow state; runnable via
  `pnpm --filter @kurasikapa/web seed:demo`.
- Dead `queueSocialPostAction` (single-caption) removed from
  `actions/side-actions.ts`; the composer uses the extended
  `actions/social.ts`.
- `packages/adapter-mongo/src/testing/mongo-harness.ts` — `KURA_TEST_MONGO_URI`
  escape hatch (same pattern as the Go service): the suite can run against an
  already-running replica set when the Docker host is too loaded to spawn
  Testcontainers. Unset, behaviour is unchanged; CI takes the container path.
- Two e2e defects the new journeys exposed, fixed:
  - Better Auth's credential-path rate limit (three sign-ins a minute, stored
    in the `rateLimit` collection) refused the fourth signed-in journey;
    `studio.spec.ts` now resets the allowance before its extra sign-in.
  - The sign-in/sign-up cross-links were distinguishable by colour alone
    (`link-in-text-block`, WCAG 2.2 AA); both are underlined.

### Still open / next (categorized)

**(a) Blocked on client / credentials**
- Flip the social send path (Facebook + Instagram Graph posts). Prerequisite:
  Meta app review + `META_PAGE_ACCESS_TOKEN` / `META_PAGE_ID`.
- R3 live TV, VOD, podcasts, media asset library. Prerequisite: AWS IVS quota
  request, Cloudinary credentials, IVS/Cloudinary sizing answers (§6).
- R4 revenue (memberships, donations, ads, classifieds). Prerequisite:
  Stripe + Paystack credentials, revenue model decisions.
- R5 intelligence + reach (SEO Center, analytics hub, public APIs, AI anchor).
  Prerequisite: budget and scope sign-off.
- §6 blockers still apply: domain name, launch date, budget, local languages
  beyond EN/FR; Stitch API key rotation; Git LFS decision; IVS quota sizing.

**(b) Requires a deployed `API_URL`**
- Deploy the Go API (`services/api`) to Render or another host and set `API_URL`
  in Vercel. Owner: ops/client hosting decision.
- Delete the TypeScript editorial packages once the Go API is the only live
  path. Prerequisite: deployed `API_URL` and a smoke-test of the cut-over
  (CMS writes/reads, public reads, cron `publish-due`).

**(c) R3–R5 future work (no code exists)**
- `media` bounded context (live TV, VOD, podcasts, galleries, TTS, media
  library).
- `revenue` bounded context (memberships, paywall, donations, ad management).
- `insight` bounded context (analytics, SEO Center, public APIs, AI-generated
  content).

### Client / external blockers
Unchanged from §6: domain name, launch date, budget, local languages beyond
EN/FR; Stitch API key rotation; Git LFS decision; IVS quota sizing; AWS,
Cloudinary, Resend, Stripe/Paystack and Meta credentials.

---

## 12. Production-readiness sweep on 2026-08-24 (green main again)

`main` had been red since 2026-08-14 (`3acf783`). Two jobs failed, and because
Lint is the first gate in the quality job, **typecheck, boundaries, tests,
build, E2E, duplication and audit had not run on that commit at all**.

### Fixed

- **Lint was environment-dependent, and the local pass was the wrong answer.**
  `apps/studio/src/external-route.ts:18` tripped
  `@typescript-eslint/no-unnecessary-type-assertion` on CI and passed locally.
  `Route` is a narrowed union only once Next has written
  `.next/types/routes.d.ts`; on a clean checkout it widens to `string`, which
  makes a necessary cast read as a redundant one. Local runs passed off a
  stale `.next` from an earlier build.

  This mattered more than the error: `pnpm verify` — the documented gate —
  returned green locally for a commit CI rejected. New `typegen` turbo task
  (`next typegen`, which is the cheap half of a build: no bundling, no
  database, no env) and `lint` now runs it first, so the gate asks the same
  question everywhere. Verified by deleting both `.next` directories and
  running `pnpm lint` from cold.

- **govulncheck: five reachable Go stdlib advisories.** GO-2026-6089 and
  GO-2026-5026 (`net/http`, via `ListenAndServe`), GO-2026-6090
  (`crypto/tls`), GO-2026-6218 (`net/url`) and GO-2026-5972 (`encoding/asn1`,
  via `ApplyURI`) — all fixed in go1.26.6. `go.mod` said `go 1.26`, which sets
  the language version and no floor, and the Dockerfile floated on
  `golang:1.26-alpine`. Added `toolchain go1.26.7` and pinned the builder
  image. `govulncheck ./...` now reports 0 affecting vulnerabilities and
  `make verify` stays green (domain 97.3%, app 94.2%).

### Built

- **`composition/production-readiness.ts`** — the gap between "the process
  starts" and "the platform works". `env.ts` validates what is needed to BOOT;
  these are the keys whose absence the code handles correctly and *silently*.
  `CRON_SECRET` unset means the cron routes 404 by design, so scheduled
  publication, RSS ingest and both digests do nothing on a site that looks
  healthy. Checked once at server start from each app's new
  `instrumentation.ts`, which refuses to come up and names every gap with what
  it costs.

  Keyed on the RAW `APP_URL` rather than `NODE_ENV` alone. Unset means nobody
  configured the deployment; explicitly loopback means a server under test —
  which is how the Playwright suite serves production builds of both apps, and
  running E2E is what caught it: the first version turned the whole gate red.
  A second defect came from the live boot — comparing `host` instead of
  `hostname` demanded `COOKIE_DOMAIN` for every local run, because cookies
  ignore the port. Both are now regression tests.

- **`observability/request-error.ts`** — `onRequestError` in both apps funnels
  every server-side render, route-handler and Server Action failure into one
  structured line with the route attached. Deliberately not a provider SDK:
  choosing one is an operations decision, and this already works with any log
  drain. It must never carry `headers` — they hold the session cookie and the
  `Authorization` header, and log retention outlives the session. Tested.

### Audit findings — NOT acted on, deliberately

Both are the two most recent merges, and both landed the lower layers without
the top one. Neither is an R1 gap; neither should be finished without a
decision.

- **KUR-66 custom JWT auth is a half-landed migration.** The stack is built and
  tested — `RegisterUser`, `SignInWithPassword`, `CompleteSecondFactor`,
  `RefreshSession`, `SignOut`, `SignInWithProvider`, `CompleteOAuthSignIn`, the
  jose/scrypt/TOTP adapters, the Mongo credential and refresh-token repos, and
  `auth-graph.ts`. **No route handler uses any of it**; `actor.ts` consumes
  only `tokens.verify`. Live auth is still Better Auth via
  `/api/auth/[...all]`, which does its own OAuth state check — so nothing is
  currently vulnerable, and `CompleteOAuthSignIn` is unreachable rather than
  bypassed. Finishing it is an auth cutover: routes, a session-migration
  window, and the `BETTER_AUTH_SECRET` → `AUTH_SECRET` rename that `env.ts`
  says "waits for a deployment window rather than riding along with KUR-66".
  Note `auth-graph.ts` does not yet expose `completeOAuthSignIn` — wire that
  when the callback route is written, so the CSRF check stays impossible to
  skip.

- **KUR-67 live broadcast has no surface.** `domain/media`, `application/media`
  (`StartBroadcast`, `EndBroadcast`, `GetCurrentBroadcast`, `ListBroadcasts`),
  the fail-closed IVS adapter and `media-graph.ts` are all built and tested.
  Nothing in `apps/` references any of it — `media-graph.ts` is the only
  consumer. This is R3 scope and blocked on the AWS IVS quota request and
  sizing answers in §6.

### Still blocked, unchanged

Deployment to Vercel + Render (hosting credentials), deleting the TypeScript
editorial packages (needs a deployed `API_URL`), the social send path (Meta app
review), `/team` content and the legal pages' real wording (client). The legal
pages carry a visible provisional notice on purpose — inventing the text would
be worse than admitting it is missing.

---

## 13. Green main on 2026-08-24 (KUR-68, KUR-69)

CI passes end to end for the first time since 2026-08-14 — every job, every
step, including the E2E journeys and the axe sweep, which had not executed at
all in that window because Lint was the first gate and it died first.

### KUR-68 — the session cutover, finished

`currentActor()` had been returning null for everyone. KUR-66 replaced the
session READ with its own JWT cookie and never landed the write, so the studio
was unreachable and every mutating Server Action saw an anonymous visitor while
sign-in appeared to succeed. E2E caught it the day it merged; nobody saw the
report.

Built: the five `/api/session` routes, `/api/oauth/[provider]` and its callback
through `completeOAuthSignIn` (which was written, tested and unreachable), the
`/api/account/two-factor` enrolment pair, and `EnrolSecondFactor`, which KUR-66
never wrote.

The part that made it safe is the lazy credential migration. The two stacks use
different stores AND different hashes — Better Auth `user`/`account`, scrypt
N=16384 r=16 p=1, `salt:key` hex; this stack `credentials`, scrypt N=65536 r=8
p=2, `scrypt$…` base64url — so a straight cutover locks out every account that
exists. `ScryptPasswordHasher.verify` now reads the legacy format,
`MongoCredentialRepository` falls back to the legacy collections, and `update`
upserts, so the rehash `SignInWithPassword` already performed becomes the
migration. It is one-way and needs no downtime.

Two traps worth remembering:

- `@better-auth/mongo-adapter` coerces every field referencing `user.id` to an
  ObjectId, so `account.userId` is NOT a hex string. The first version matched
  hex only, found the user and then no account, and returned "those details did
  not match an account" for a correct password. The tests seeded hex only and
  passed. They are parameterised over both forms now.
- An account with Better Auth two-factor enrolled is refused, not migrated. Its
  secret lives in a schema this stack does not read, so migrating would return
  `totp: null` and sign the user in on a password alone.

`/api/auth/[...all]` stays mounted: it is now only a legacy account-creation
path whose rows migrate on first sign-in, and the E2E seed still uses it, which
means the studio journeys exercise the migration exactly as a deployment will.
Retiring it is the last step — nothing else calls it.

### KUR-69 — contrast

73 axe violations, all `color-contrast`, all from the redesign in f4bf93a. Now
zero. Two layers of fix:

- The footer's muted white-on-#08150d was below 4.5:1 and appears on every
  page: opacity only, /35 → /48 and /40 → /52.
- `--color-primary` and `--color-secondary` fail as text on light surfaces and
  cannot simply be darkened, because both are also text on the near-black
  header and footer where a darker value fails the other way. New
  `--color-primary-ink` and `--color-secondary-ink` carry the same hues at
  4.92 and 4.94; the fills keep the logo's green and amber. The rule is the
  SURFACE, not the class — two eyebrows inside `bg-inverse-surface` containers
  had to be reverted after being converted.

The sweep now runs with `reducedMotion: 'reduce'`. `.reveal` fades over 760ms
and axe was sampling mid-animation, reporting whatever opacity it caught.

### Still open

Unchanged: deployment to Vercel + Render, the social send path, `/team` content
and the legal pages' wording, and everything in R2–R5. Two new items:

- Retire Better Auth once nothing creates accounts through `/api/auth`, and
  drop `better-auth` from `packages/web-kit`.
- The studio refreshes by calling the site's `/api/session/refresh`
  cross-origin. That works in both deployment shapes but is only exercised
  same-origin by the suite; the split-origin path needs a real deployment to
  prove.

---

## 14. KUR-70 — first production deployment (2026-08-30)

**Status: DEPLOYED — Render API, public web, Studio, and protected schedules
are live. Custom-domain DNS remains an external registrar action.**

- Render `kurasikapa-media-api` is live on the Starter plan in Frankfurt at
  `https://kurasikapa-media-api.onrender.com`. The deployed commit is
  `a2ce022`; `GET /healthz`, the unauthorised write guard, hidden cron guard,
  and authorised publish-due cron all pass `scripts/smoke-api.sh`.
- `kurasikapa-web` and `kurasikapa-studio` exist as separate Vercel projects,
  linked to this GitHub monorepo with roots `apps/web` and `apps/studio`. Their
  production environment contracts share the same auth, cache-revalidation,
  cron, database and API values. Deployment protection is disabled for these
  public production projects.
- Public web deploy `dpl_HX5h9ZHNMRwr4DrWpwEG5TaHWSkG` and Studio deploy
  `dpl_5AcWRKfpJGr8iHmVtzLESbUJpsMk` are READY from `main`; both stable Vercel
  aliases return HTTP 200. The protected publish-due and RSS endpoints return
  200 with the shared secret, while a wrong secret returns 404.
- Vercel Hobby rejects sub-daily cron definitions. KUR-70 therefore moves the
  protected Studio schedules to `.github/workflows/studio-cron.yml`: publishing
  and social delivery every five minutes, RSS ingestion hourly, plus manual
  dispatch. GitHub `CRON_SECRET` matches Studio and Render. Social delivery is
  gated by `ENABLE_SOCIAL_CRON=true` until Meta credentials are approved.
- `kurasikapa.tv` and `studio.kurasikapa.tv` are attached to their projects,
  but DNS is not configured. Required external DNS records are apex A records
  `216.198.79.1` and `64.29.17.1`, plus `studio` CNAME
  `20885681fed6c319.vercel-dns-017.com`.
- Deployment fixes landed in this branch: Render no longer overrides its
  managed `PORT`; the API service name has a collision-free hostname; the
  smoke script matches the real Go routes and fail-closed status codes; and
  Studio's `vercel.json` no longer uses an unsupported pseudo-comment key.
- Follow-up entrypoint repair: the Studio project's bare Vercel host and
  `/studio` now redirect to the public Vercel host's `/studio/en`, so the
  provider dashboard URL no longer lands on a platform 404. The public project
  rewrites `/studio/*` to the separately deployed Studio project. This is the
  documented same-origin shape: it needs no custom domain and keeps editor
  session cookies valid across the public and Studio surfaces.
- The public home and news routes now use a designed editorial holding state
  instead of the bare “Nothing published yet” line: newsroom status, launch
  context, reader actions, and a concise statement of what the first edition
  will deliver.
