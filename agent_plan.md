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
| HEAD | `3bebf4a` — KUR-28 |
| Commits | 28 (`KUR-1` … `KUR-28`) |
| Unit tests (TS) | 579 passing — domain 180 · application 178 · adapter-mongo 80 · adapter-anthropic 27 · web 114 |
| Unit tests (Go) | `services/api` — shared package only so far, 95.2% coverage |
| E2E | 25 Playwright journeys + 4 axe WCAG 2.2 AA checks, all passing |
| Gates | `lint` 0 · `typecheck` 0 · `boundaries` 0 · `jscpd` 0.22% · `next build` 0 · `go vet`/`gofmt`/`go test -race` 0 |
| Deployed | **No.** Nothing is on Vercel or Render yet. Local only. |

Run `pnpm verify` before claiming any task is done. It runs the gates in CI order.

---

## 2. The shape of the system

Two deployable hexagons over one MongoDB cluster.

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

`apps/web/src/composition/` is the only place allowed to import an `adapter-*`.
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

### 3.2 Application (`packages/application`) — 33 use cases

- **editorial (16)** — CreateDraft, UpdateDraft, GetDraft, GetPublishedArticle,
  SubmitForReview, ApproveArticle, RejectArticle, SchedulePublication,
  PublishArticle, PublishDueArticles, UnpublishArticle, ListAuthoredArticles,
  ListAwaitingReview, ListPublishedArticles, BrowseCategory, ListSections
- **identity (3)** — ResolveActor, AssignRoles, ListUsers
- **audience (14)** — SaveArticle, RemoveSavedArticle, ListSavedArticles, SearchArticles,
  PostComment, ModerateComment, ListVisibleComments, ListPendingComments,
  LikeArticle, UnlikeArticle, CountLikes, RecordReading, ListReadingHistory, CountReadings
- **distribution (2)** — QueueSocialPost, PublishDuePosts

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
| UserDirectory | `MongoUserDirectory` | wired — **the only file that reads Better Auth's `user` collection** |
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

### 3.5 Editorial studio (`apps/web/app/[locale]/studio/`)

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
| **`ListUsers` beyond roles** | works | Only used by the roles screen. |

---

## 5. NOT built

### 5.1 R1 remainder — needed to actually close R1

| Item | State |
|---|---|
| **Deployment to Vercel + Render** | Not done. R1's exit criterion says "on production". Hosting for the Go service is now an open question — Render was chosen for a worker, not for the primary API. |
| **The Go backend itself** | Domain → HTTP serving done (KUR-29 … KUR-43). Editorial BFF cutover done (KUR-45) for CMS writes/reads and public-site reads when `API_URL` is set. Remaining: delete TS editorial packages once a deployed API is the only live path. |
| ~~Audit logs~~ | **DONE — KUR-38.** Every domain event is recorded. Append-only enforced by the port having no update or delete, and tested against a real database. Screen at `/studio/audit`, gated on `audit:read`. |
| ~~**Rich-text editor**~~ | **DONE.** Textarea + Markdown toolbar (bold/italic/heading/link). `ArticleBody` parses a safe subset into React children — still no HTML, still no sanitiser dependency. |
| ~~Security headers~~ | **DONE — KUR-37.** CSP and Permissions-Policy added; the rest were already in next.config.ts (my earlier note checked proxy.ts and was wrong). Applied to every route including /api. |
| ~~Rate limiting~~ | **DONE — KUR-39.** AI endpoints limited via a shared MongoDB counter (fails closed). Auth limited by Better Auth's own limiter, moved to database storage — its in-memory default is per-instance and limits nothing on serverless. Search limited too (fails open — it is the least valuable thing to protect and the most visible to break). |
| ~~**2FA**~~ | **DONE.** Better Auth `twoFactor` plugin; verify page at `/[locale]/two-factor`; enable UI on the profile Security card. |
| ~~**CAPTCHA**~~ | **DONE.** Cloudflare Turnstile, env-gated. Unset keys leave sign-in alone (Playwright still works). |
| ~~**Google Analytics**~~ | **DONE.** gtag loads only after the consent banner; unset `NEXT_PUBLIC_GA_MEASUREMENT_ID` renders nothing. Search Console still needs the client property. |
| **Scheduling actually firing** | Article cron live (KUR-34). Social cron live and fail-closed until Meta credentials exist. |
| **Remaining designed screens** | Five built routes still use my layouts rather than the supplied designs — see §3.7. |
| ~~**Error tracking**~~ | **DONE.** Locale + global error boundaries; failures go to stderr via `reportError`. A Sentry DSN is still a hosting choice — the boundary no longer swallows. Backups remain Atlas/ops, not code. |
| **RSS out** | **DONE.** `/{locale}/feed.xml` from the published list. RSS *ingest* is still R2/media-svc. |

### 5.2 R2 — Audience & Distribution

Domain for saved articles, comments and social posts exists (§3). Comments are
pre-moderated: a reader post stays pending until an editor with `comment:moderate`
approves it. Likes and reading history are live. Newsletter **double opt-in is live
and fail-closed** (KUR-50): subscribe at `/[locale]/newsletter`, confirm link,
unsubscribe; Resend unset → `EmailDeliveryFailed`, nothing mailed. Digests still
wait on a live `RESEND_API_KEY`. **PWA offline reading is live (KUR-51):** installable
manifest, production service worker, network-first cache of visited articles /
sections / home. Studio, auth, profile and RSC flights stay on the network.
Remaining open: breaking-news alerts, push
notifications, Facebook + Instagram publishing (adapter + cron wired; Meta app review
and tokens still blocked), RSS ingest (out is live), related / recommended (needs
`EmbeddingPort` — **declared, no adapter**, and Atlas Vector Search). **Most-read
is live (KUR-52):** unique-reader ranking from existing reading rows; homepage
Trending Now prefers that rail and falls back to leftover recency. No embeddings.

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
