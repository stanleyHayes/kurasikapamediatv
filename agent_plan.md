# agent_plan.md — what is built, what is available, what is next

> **Status doc, not a design doc.** Every claim here was verified against the
> repository on 2026-08-31. Where something is *not* built, it says
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
| HEAD | `main` — public Web and independent Studio deployables |
| Commits | 65 (`KUR-1` … `KUR-65`) |
| Unit tests (TS) | 912 passing — domain 233 · application 271 · adapter-mongo 115 · adapter-anthropic 28 · web 265 |
| Unit tests (Go) | `services/api` — editorial domain + app + HTTP, 97.3% domain / 90.2% app |
| E2E | 25 Playwright journeys + 4 axe WCAG 2.2 AA checks, all passing |
| Gates | `lint` 0 · `typecheck` 0 · `boundaries` 0 · `jscpd` 0.22% · `next build` 0 · `go vet`/`gofmt`/`go test -race` 0 |
| Deployables | **Three:** `apps/web` (public), `apps/studio` (CMS, basePath `/studio`), `services/api` (Go). See [ADR-0011](docs/decisions/adr-0011-studio-is-its-own-deployment.md). |
| Deployed | **Web + Studio on Vercel; Go API on Render.** Studio is canonical at `kurasikapa-studio.vercel.app/studio`; the API is health-checked independently and reached through `API_URL`. |

Run `pnpm verify` before claiming any task is done. It runs the gates in CI order.

### Current delivery — newsroom and operations uplift

| Workstream | State | Acceptance evidence |
|---|---|---|
| Independent Studio auth, recovery, branded login and navigation shell | **DONE** | Studio production auth and password recovery verified; nested shell loading prevents sidebar navigation from replacing the whole app shell. |
| Original news creation | **DONE** | `/studio/{locale}/articles/new` creates a private original draft and opens the existing editor; dashboard and sidebar make it the primary newsroom action. Existing review, approval, schedule and publish transitions remain the control. |
| RSS source intake distinction | **DONE** | RSS is labelled Source monitor and remains optional draft intake. Imported material never bypasses editorial review or auto-publishes. |
| Careers, FAQ and Help | **DONE** | Permanent public framing remains static. Studio manages structured open-role, FAQ and help records; public routes render those records with useful empty states and EN fallback. |
| Role-specific invitations | **DONE** | People supports role selection, seven-day one-time links, hashed tokens, pending KPIs, resend, revoke and recipient account activation. Application and real-Mongo invitation suites pass. |
| People operations patterns from RentOS/Xtiitch | **DONE** | Combined secure invite lifecycle with searchable members, pending visibility, role/status operations and concise role explanations. |
| Dashboard KPIs and visualisations | **DONE** | Sourced workflow, review, moderation and language-publication KPIs plus workflow bars, queue bars and language chart; no invented totals. |
| Full gates, production deploy and live workflow smoke tests | **DONE** | Lint, typecheck, boundaries, all TS suites, duplication and Go verification passed. Both Vercel projects reached Ready; live Studio sign-in/create-story and public Careers/invitation routes responded successfully. |
| Client-demo presentation pass | **DONE** | Shared animated empty-state frame covers public collections, search, reader libraries, comments and Studio queues; Studio has a dedicated newsroom splash and the login logo no longer sits on a white plate. Production now contains 35 EN/FR stories, 11 sections, comments, FAQ, Help and Careers records, all ownership-tagged for a one-command selective clear. `pnpm verify` passed; both Vercel projects are Ready and the live FAQ and independent Studio login smokes return 200. |
| Editorial authoring and spatial UI consistency | **DONE** | New-story intake opens the canonical Markdown-backed rich editor immediately, the last native select is replaced by the branded picker, route loading is a composed newsroom transition, and shared signal/card grids have isometric depth with reduced-motion fallback. `pnpm verify` passed; both Vercel projects reached Ready; authenticated desktop/mobile Studio and public grid surfaces were rendered in production. |

### Discovery completion programme

The user expanded the standing objective on 2026-08-31 from the current R1/R2
delivery to **every unimplemented requirement in the discovery questionnaire**.
Work remains release-shaped so each slice can ship and be verified independently:

| Programme | State | Exit evidence |
|---|---|---|
| Demo-ready editorial surface | **DONE** | Polished empty/loading states, removable realistic content, rendered desktop/mobile review, full verification and production deployment completed on 2026-08-31. |
| Television and multimedia | **IN PROGRESS** | Programme schedule, presenters, live enhancements, replay/video, podcasts, galleries, media library, captions and transcripts. |
| Growth and intelligence | **IN PROGRESS** | News sitemap plus first-party traffic, acquisition, retention and newsletter analytics are deployed; Search Console operations, semantic search and personalised recommendations remain. |
| Revenue | **IN PROGRESS** | Memberships, donations, checkout, confirmation, KPIs and the subscriber ledger are implemented. Advertising has tested campaign, activation, placement, budget, event and report APIs plus Studio operations and disclosed public placements. Products, paid review-gated classifieds and disclosed affiliate inventory now have end-to-end persistence, Studio operations and public surfaces. Advertiser self-service is implemented and awaits release verification. |
| Remaining discovery scope | **QUEUED** | Additional languages, integrations, security/DR evidence, public API/future surfaces and final launch verification. |

### Production-readiness audit reconciliation — 2026-08-31

| Audit requirement | Current evidence | State |
|---|---|---|
| Real production journalism | The complete create/review/approve/publish workflow and 11-category inventory are live. Editors can now attach a ready media-library image with required alt text, credit, caption and stable CDN delivery; public cards, article pages, social metadata and structured data consume it. Production still contains client-preview data rather than real reporting, so approved copy, reporter identities and photography are required before this can close. | **IMPLEMENTED — BLOCKED ON CLIENT CONTENT** |
| Television identity | The Live page and broadcast control room now have presenter/programme directories, scheduled transmissions, calendar reminders and caption-gated replay rails. The production Go API owns the matching media aggregates, repository ports, indexed Mongo persistence, authenticated Studio commands and public guide endpoint; both deployables prefer this BFF seam when `API_URL` is set. Full repository verification and production smoke checks pass; real schedule, presenter and licensed replay inventory are still client inputs. | **DEPLOYED — BLOCKED ON CLIENT PROGRAMMING** |
| Multimedia system | Live broadcast plus television schedule/replay metadata exist. A Go-owned media library covers signed image, video, audio, caption, transcript and document intake. Podcast and photo/video gallery publishing are implemented. Verified image attachment and editor-approved article narration run through Go domain/application/API/Mongo and render publicly. Uploaded video reports receive adaptive Cloudinary HLS playback and generated posters while retaining mandatory captions. IVS now refuses unrecorded channels; ended live slots have a private replay queue and only ready video plus WebVTT captions can publish into the adaptive public player. Automatic IVS recording promotion is deployed. Browser-local English/French voice-to-article dictation is code-complete and awaiting production verification. | **PARTIAL — ACTIVE R3 RELEASE** |
| Monetisation | Membership tiers, recurring subscriptions, donations, entitlement, checkout, signed webhooks, Studio management, public support, multi-currency KPIs and a subscriber ledger are implemented. Advertising, products, paid classifieds and disclosed affiliate inventory are code-complete across Studio and public surfaces. Provider credentials, the quota-delayed public release and advertiser self-service remain. | **PARTIAL — ACTIVE R4** |
| Newsroom intelligence | Operational workflow KPIs remain. A consent-aware, append-only first-party page-view pipeline and dedicated Studio analytics route now provide views, unique/returning readers, traffic trends, acquisition/search share, top story/category/author performance and newsletter growth in production. Revenue/campaign reporting waits on R4. | **DEPLOYED — REVENUE METRICS MOVE WITH R4** |
| Institutional credibility | Dates, publisher/contact pages and `NewsArticle` structure exist. Studio now publishes locale-specific newsroom profiles from invited users and verified media-library portraits; public Team cards, individual author pages, linked bylines and Person/author structured data consume them. No identities are invented, so launch still requires approved names, biographies, portraits and public links from the client. | **IMPLEMENTED — BLOCKED ON CLIENT IDENTITIES** |
| News SEO operations | Standard sitemap, robots, RSS, canonicals and `NewsArticle` JSON-LD exist. The rolling two-day `/news-sitemap.xml` is deployed and returns HTTP 200. Search Console ownership/submission and indexing monitoring still require access to the publisher account. | **DEPLOYED / SEARCH CONSOLE ACCESS BLOCKED** |
| Deployment naming | `kurasikapa-web.vercel.app` is attached and `APP_URL` resolves generated sitemap and robots URLs to `https://kurasikapa.tv`; the old long project URL is no longer the only public address. | **DONE** |

Implementation rule for this delivery: original reporting is the primary content
workflow. RSS sources are an optional monitoring and draft-intake tool, never a
substitute for authoring and never a path around editor approval.

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
`audience` · `revenue` · `insight`. Editorial, identity, media and revenue now
have Go domain/application/adapter paths; audience and insight remain in the
TypeScript transition path while distribution spans both runtimes.

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

The editorial desk now includes four sourced KPI cards and three operational
visualisations: the signed-in editor's workflow mix, the latest published
English/French inventory, and the review/moderation decision queues. Publication
figures are explicitly labelled as a 50-item-per-language snapshot; the Studio
does not present sampled data as lifetime totals. Route loading stays inside the
workspace canvas so sidebar navigation preserves the shell instead of flashing
the full-page startup splash.

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
| `kurasikapa_media_podcast_library` | `/podcasts` | ✅ accessible series/episode library, chapters, transcripts and RSS feed (KUR-76; deployed) |
| `kurasikapa_media_live_tv_gallery` | `/live` + `/galleries` | ✅ live/schedule/replay plus photo and caption-gated video galleries deployed (KUR-77) |
| `kurasikapa_media_events_summits` | — | ❌ no route (R3) |
| `kurasikapa_admin_media_library` | `/studio/media` | ◑ signed direct upload and inventory implemented; production credentials/release and article attachment remain (R3) |
| `kurasikapa_media_membership_donations` | `/support` | ◑ memberships and one-time contributions implemented; provider credentials and release remain (KUR-80) |
| `support_membership_kurasikapa_media_tv` | `/support` | ◑ public GHS/EUR support journey implemented with honest empty state and provider handoff (KUR-80) |
| `monetization_dashboard_kurasikapa_admin` | — | ❌ no route (R4) |
| `kurasikapa_admin_subscriptions_revenue` | `/studio/revenue` | ✅ tier management, confirmed-payment KPIs, currency-separated visualisations and subscriber ledger implemented (KUR-80/KUR-81); provider credentials/release remain |
| `kurasikapa_admin_analytics_hub` | `/studio/analytics` | ✅ first-party audience KPIs, traffic/acquisition/retention and content/newsletter visualisations deployed; revenue intelligence is now available in `/studio/revenue` |
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
| ~~**Deployment to Vercel + Render**~~ | **DONE.** Web and independent Studio are live on Vercel; the Go API is live on Render and the stable `/healthz` route is monitored. |
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

The TypeScript and Go media contexts now include live broadcast plus presenter,
programme and schedule aggregates; tested Mongo adapters; a Studio television
manager; public guide, reminders and replay presentation; and a domain rule that
recorded replays require captions. The Go API exposes authenticated programming
commands and a public guide, and both Next.js applications prefer that BFF path
when `API_URL` is set.

The shared Studio media library now creates pending assets in Go, signs direct
Cloudinary browser uploads, verifies signed receipts server-side and persists
ready assets in Mongo. It covers image, video, audio, caption, transcript and
document files, requires image alt text, and fails closed without provider
credentials. Production promotion and credentials remain active.

Podcast publishing is now implemented end to end: Studio creates and explicitly
publishes series and episodes, publication requires ready audio and transcript
assets, chapters are validated against duration, Mongo indexes the public
library, and the public site renders a native accessible player plus a
Podcasting 2.0 RSS feed with transcript metadata. Production release remains.

Article hero-image attachment is implemented with ready-image validation,
required alternative text and visible credit. Uploaded video reports now use
Cloudinary's adaptive `sp_auto` HLS delivery plus generated first-frame posters;
the public player shares the tested HLS recovery engine with Live TV and keeps
caption tracks mandatory. Article-to-audio is implemented as an asynchronous,
editor-approved English/French workflow using Polly, private S3 staging and
Cloudinary delivery; Twi fails closed until a reviewed voice exists. Automatic
promotion of completed IVS recordings from private S3 into Cloudinary is
deployed. Voice-to-article now has an editor-owned browser transcription port:
speech stays local to the rich Markdown editor until the journalist explicitly
creates a draft. IVS capture and caption-gated replay publication are implemented.

Providers are now settled — [ADR-0010](docs/decisions/adr-0010-media-stack.md):
**Amazon IVS** for live broadcast, real-time call-in stages and moderated chat;
**Cloudinary** for images, VOD and podcasts. Mux is superseded, unbuilt.

The remaining R3 work is provider activation and production verification of
voice dictation; approved replay/video/article audio render with the required
player, caption or transcript affordance.

### 5.4 R4 — Revenue

Membership tiers, domain-level entitlement, donations, Stripe EUR and Paystack
GHS checkout, signed webhook confirmation, currency-separated KPIs and the
subscriber ledger are implemented. Ad inventory, delivery, Studio operations
and public placements are implemented. Products, paid classifieds and disclosed
affiliate links are code-complete; the advertiser self-service portal remains.

### 5.5 R5 — Intelligence & Reach

The first-party insight foundation is now implemented locally: append-only,
consent-aware article views, 400-day retention, acquisition/search attribution,
traffic and unique/returning-reader trends, content/author/category rankings,
newsletter growth and a dedicated Studio analytics hub. Revenue/campaign
reporting waits on R4. SEO Center, semantic recommendations, heatmaps, AI news
anchor, AI podcast/video generation, chatbot, public APIs and native apps remain.

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

1. **Affiliate inventory** — add disclosed tracked placements with campaign
   ownership and reporting.
2. **Advertiser self-service** — expose only the campaign capabilities already
   enforced by the revenue domain.

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

- **KUR-67 live broadcast surface — IMPLEMENTED, provider activation blocked.**
  The shared container now wires Mongo broadcasts and the fail-closed Amazon
  IVS provider. Studio has an authorised/rate-limited control room with one-time
  OBS credentials and channel teardown; the public bilingual `/live` route
  reads the current broadcast and plays HLS with native Safari support plus
  `hls.js`. Public state is polled every 15 seconds through a CDN-shared status
  projection (10-second freshness, 20-second stale window), not Mongo per
  viewer. Broadcast operations await the correctness indexes before use, and
  failed teardown remains live, start-blocking, visibly retryable and idempotent.
  Production still needs AWS credentials and the IVS quota increase
  in `docs/operations/live-broadcast.md`. Recording/VOD, call-in stages and chat
  remain later R3 scope and are not claimed here.

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
- Follow-up independent-auth repair: Studio owns its password/MFA session
  endpoints, so its bare Vercel host and `/studio` now stay on the Studio
  deployment and redirect locally to `/studio/en/sign-in`. Protected page
  loaders also redirect signed-out deep links before they can surface a
  `NotSignedIn` render error. Commit `41009b1` is awaiting production because
  Vercel rejected the manual release after the account exceeded the hard
  100-deployments-per-24-hours Hobby quota.
- The public home and news routes now use a designed editorial holding state
  instead of the bare “Nothing published yet” line: newsroom status, launch
  context, reader actions, and a concise statement of what the first edition
  will deliver.
- Public sign-in and registration fields now share one accessible input
  treatment with leading semantic icons, task-specific placeholders, visible
  focus treatment, and a trailing show/hide control on password fields.

## 15. KUR-71 — production news navigation (2026-08-30)

**Status: DEPLOYED — bilingual local-to-global navigation is live.**

- Replaced the four-link hard-coded menu with a newsroom hierarchy: Latest,
  Ghana, Africa, World, Politics, Business and Sports, with Education, Health,
  Technology, Culture, Entertainment, Lifestyle, Opinion and Editorial under
  More. This follows the locality-to-world and core-desk pattern used by
  established Ghanaian and international newsrooms without copying their UI.
- Every label and section slug is locale-aware. French links use `politique`,
  `economie`, `afrique`, `monde`, `sante`, `technologie`, `divertissement` and
  `art-de-vivre` rather than sending French readers to English soft-404s.
- Desktop, utility and mobile navigation now use route-derived active states,
  visible high-contrast treatments and `aria-current="page"`. The misleading
  nonfunctional Live item was removed until a real live destination exists.
- Production now has the 14 root-level bilingual section records. They were
  written through an idempotent, one-use secret-protected seed and the route
  and secret were removed immediately afterward.

## 16. KUR-76 — accessible podcast publishing (2026-08-31)

**Status: DEPLOYED — CI and production routes verified.**

- Go domain and application layers now own podcast series and episodes behind
  separate repository ports. Series publication is explicit; episode
  publication requires ready audio and transcript assets, and chapters must be
  ordered inside the recording duration.
- Mongo repositories round-trip series, episodes, artwork and chapters and
  provide named public-library indexes. Authenticated API commands and the
  public locale library are wired through the Go composition root.
- Studio has a dedicated podcast manager with branded asset choices, explicit
  busy/disabled feedback, chapter entry and meaningful empty states. The public
  site has a bilingual podcast route, native audio controls, transcript links,
  chapters and a Podcasting 2.0 RSS feed.
- Evidence: `pnpm verify` is green; the clean Go race/coverage gate reports
  domain 96.6% and application/HTTP 90.1%; real-Mongo adapter integration is
  green; the editorial transition completes in 6.9s under Playwright; and the
  new `/en/podcasts` route has no axe WCAG 2.2 AA violations. CI run
  `33405841662` is green; public web, Studio and Render podcast endpoints each
  returned HTTP 200 in production.

## 17. KUR-77 — photo and video gallery publishing (2026-08-31)

**Status: DEPLOYED — CI and all production routes verified.**

- Added a Go gallery aggregate with photo/video permissions, explicit
  publication, required editorial captions and immutable publication time.
  Video publication additionally requires a synchronized caption asset.
- Application validation resolves every gallery item to a ready asset of the
  correct type; Mongo persists ordered media, caption references and credits
  behind a named public-library index; authenticated commands and a public
  locale endpoint are wired through the API composition root.
- Studio now curates multiple visual assets without native selects, captures
  per-item captions and credits, and assigns captions per video. The public
  `/galleries` route uses an editorial dimensional grid, meaningful empty
  state, image alt text, native video controls and caption tracks.
- Evidence: `pnpm verify` is green; the clean Go race/coverage gate reports
  domain 96.6% and application/HTTP 91.5%; the real-Mongo adapter integration
  suite passes; and `/en/galleries` has no axe WCAG 2.2 AA violations. CI run
  `33407743601` is green. Studio and Render gallery endpoints return HTTP 200.
  After the Vercel quota reset, the public deployment promoted successfully;
  `/en/galleries` now returns HTTP 200 alongside the Studio and Render routes.

## 18. KUR-78 — first-party newsroom intelligence (2026-08-31)

**Status: DEPLOYED — CI and production routes verified.**

- Added an append-only page-view aggregate and repository port. The browser
  records only after analytics consent, the web edge hashes its random visitor
  token before it enters the application, and Mongo automatically expires
  events after the documented 400-day retention period.
- `BuildNewsroomReport` is permission-gated and produces honest 7/30/90-day
  views, unique and returning readers, daily traffic, acquisition/search share,
  top stories/categories/authors and newsletter subscriber growth. No revenue
  value is invented while the payment and campaign context remains unbuilt.
- Studio now has `/analytics`, period controls, dimensional KPI cards,
  accessible traffic and ranking visualisations, and explicit data-empty copy.
- Evidence: `pnpm verify` is green, including 177 real-Mongo adapter tests;
  the focused browser journey records a consented article view with HTTP 204;
  and authenticated `/studio/en/analytics` has no axe WCAG 2.2 AA violations.
  That accessibility audit also exposed and fixed pre-existing Studio sidebar
  contrast failures. CI run `33411985796` is green; the production Studio
  analytics route returns HTTP 200, and the same public deployment promoted
  the analytics beacon, gallery route and two-day news sitemap.

## 19. KUR-80 — memberships, donations and trusted payment confirmation (2026-08-31)

**Status: PUBLIC WEB DEPLOYED; STUDIO/API RELEASE BLOCKED — provider credentials pending.**

- Added the Go revenue context with GHS/EUR money, membership tiers, pending,
  active and canceled subscriptions, one-time donations and domain-owned
  article entitlement. Pending checkout never grants access; cancellation
  preserves access only to the paid-through boundary.
- Added repository and payment ports, real Mongo persistence with named unique
  provider-reference and reader-entitlement indexes, and direct Paystack/Stripe
  checkout adapters. Missing provider credentials fail closed without creating
  a pending record.
- Paystack SHA-512 and Stripe timestamped SHA-256 webhook verification is the
  only confirmation path. Provider retries are idempotent, and browser return
  URLs cannot activate a membership or manufacture donation revenue.
- Added `/support` with GHS/EUR choice controls, useful membership empty state,
  secure checkout handoff and disabled animated busy states; Studio has a
  non-native-control membership manager at `/revenue`.
- Evidence: Go domain coverage is 96.7% overall and 100% for revenue; a
  cache-cleared application/HTTP run is 91.2%; adapter, use-case, HTTP and BFF
  tests pass. Public deployment `dpl_FgTkaGd1gECjDxnduKXWGisp8Mnb` is Ready.
  CI run `33417848504` is green. The Studio/API release remains before this
  slice can be called fully deployed; Vercel is currently rejecting additional
  Studio builds at its 100-deployments-per-24-hours limit. Advertising,
  products, classifieds, affiliates and revenue dashboards remain separate R4
  slices.

## 20. KUR-81 — revenue intelligence, subscriber ledger and social cards (2026-08-31)

**Status: CI GREEN; API DEPLOYED — Vercel release quota-blocked.**

- Added a permission-gated revenue report over confirmed provider state with
  active/pending/canceled subscriber counts, successful gifts, gross revenue,
  membership/gift mix, MRR and payment activity. GHS and EUR remain separate;
  the report never invents an exchange rate or treats a pending checkout as
  earned revenue.
- Subscription records now retain the checkout email needed by operators. The
  Studio Revenue desk has 7/30/90-day KPI cards, data visualisations, meaningful
  zero-data states and a recent subscriber ledger with paid-through visibility.
- Added `/og-image`, a dynamic 1200x630 branded social-card endpoint. Global
  Open Graph/Twitter metadata uses it; article metadata renders the headline
  into the card and `NewsArticle` JSON-LD references the same absolute image.
- Evidence: full `pnpm verify` and CI run `33420210277` are green. Go
  verification passes at 96.7% domain and 90.9% application/HTTP coverage;
  web-kit has 298 passing tests with 80.76% branch coverage. Render now exposes
  the protected `/revenue/report` route (anonymous request correctly returns
  403). The public and Studio builds remain unpublished because Vercel again
  rejected the final deployment at its 100-deployments-per-24-hours limit.

## 21. KUR-82 — advertising inventory and delivery foundation (2026-08-31)

**Status: CODE COMPLETE; production release active.**

- Added accessible ad campaigns with explicit slot, locale, HTTPS creative and
  destination, alt text, GHS/EUR budget, CPM, priority and bounded delivery
  window. Activation is permission-gated and expired campaigns fail closed.
- Placement selection is deterministic and checks active state, locale, slot,
  delivery window and estimated CPM spend before serving. Impression and click
  records are immutable and contain no reader identity, IP address or tracking
  profile.
- Added Mongo campaign/event repositories with named eligibility/count indexes,
  public placement/event endpoints and permission-gated campaign reporting.
  Public responses expose only the disclosure/rendering fields required by an
  ad placement.
- Studio Revenue now includes campaign creation, explicit activation, language
  and placement controls, accessible creative text, delivery windows,
  currency-separated budget/spend, impressions, clicks and CTR. It uses no
  native select controls and preserves the shared depth-grid visual language.
- Home, article and Live render the three supported placements. Every creative
  is visibly labelled as an advertisement and paid placement, uses sponsored
  link semantics and records anonymous delivery events without reader identity.
- Evidence: `make -C services/api verify` passes with 96.6% domain and 90.0%
  application/HTTP coverage; domain, application, Mongo and HTTP lifecycle
  tests cover validation, budget enforcement, placement, events and reporting.
  Full `pnpm verify` passes; web has 77 tests and 93.75% function coverage, and
  web-kit has 301 tests with 80.70% branch coverage.

## 22. KUR-83 — credited article photography and production handoff (2026-08-31)

**Status: DEPLOYED; client content and provider setup remain.**

- Added a Go-owned article hero snapshot tied to a verified media-library
  asset. Attachment is allowed only while the story is editable and refuses
  pending, failed, non-image or wrong-locale media.
- Every lead image carries an HTTPS delivery URL, alternative text, caption,
  visible credit and dimensions. Mongo and the transitional TypeScript mapper
  preserve the same document shape so either runtime cannot erase the field.
- Studio article editing now includes a verified-image chooser without granting
  authors upload permissions. The chosen image remains visible with its caption
  and credit before review.
- Public Home, Latest and reusable story cards render real photography when
  present; the article page renders an accessible figure and uses the same image
  for Open Graph, Twitter and `NewsArticle` structured data. Existing branded
  artwork remains the fallback when a story has no approved photograph.
- Added [production deployment handoff](docs/production-deployment-handoff.md),
  covering account ownership, credentials, editorial/legal inputs, environment
  placement and current mid/high operating budgets. `.env.production` was
  corrected locally for the independent Vercel-host shape and remains ignored.
- Evidence: CI run `33429262483` passes lint, TypeScript, boundaries, package
  coverage, builds, E2E/accessibility, duplication, dependency audit,
  Lighthouse, secret scan, Go race tests and real-Mongo integration. Go reports
  96.5% domain and 90.9% aggregate application/HTTP coverage locally after a
  clean cache; the CI-pinned runtime also clears its 90% floor.
- Production deployment `dpl_CreKjs4YCFhLkTDct1mTpFZCqNpt` is Ready. The stable
  public alias returns `200 image/png` from `/og-image` without a locale
  redirect; public Team and Studio sign-in return 200, and API `/healthz`
  reports healthy. `kurasikapa.tv` is attached in Vercel but still requires
  working DNS. Real editorial content and provider credentials remain governed
  by the production handoff.

## 23. KUR-84 — credible newsroom profiles and accountable bylines (2026-08-31)

**Status: DEPLOYED; client identities remain the launch-content gate.**

- Added a Go-owned `StaffProfile` identity aggregate and `profile:manage`
  permission. Profiles are translated per user and locale; updates return a
  published profile to draft, and publication requires a ready image from the
  verified media library.
- Added application ports/use cases, hand-written fakes, indexed Mongo
  persistence and authenticated/public HTTP routes. Unique `(userId, locale)`
  and `(locale, slug)` indexes protect identity and public URLs from races.
- Studio People & access now includes a no-native-select profile publisher for
  choosing a newsroom member, language and verified portrait, plus approved
  biography and optional HTTPS public link.
- The public Team page renders published profiles with useful empty-state copy;
  each person has a canonical author page, Person structured data and verified
  links. Articles retain the author id across the Go BFF and link their byline
  and portrait to that profile. `NewsArticle.author` includes the profile URL
  when one exists, while unpublished identities keep the honest newsroom
  fallback.
- Full `pnpm verify` is green: lint, type checks, dependency boundaries,
  package coverage, duplication, Go vet/race tests and the 95% domain / 90%
  application coverage floors all pass. Explicit Web and Studio production
  builds also pass against the deployed Go API.
- The build audit exposed one remaining TypeScript Mongo read in the homepage
  popularity rail. API-backed deployments now omit that unavailable ranking
  and use the existing recency fallback, keeping Vercel prerendering independent
  of Mongo while preserving the local TypeScript fallback until audience
  ranking is ported to Go.
- Commit `5706c3b` passed CI run `33434346227`, including the Go service and
  real-Mongo integration, package gates, builds, E2E/accessibility, Lighthouse
  and secret scanning. Production smoke checks return 200 for API `/healthz`,
  API `/public/en/team`, public `/en/team` and Studio
  `/studio/en/sign-in`. The public profile list is intentionally empty until
  the client approves real names, biographies and portraits.

## 24. Production environment and client handoff refresh (2026-08-31)

**Status: LOCAL HANDOFF READY; provider credentials and client material remain.**

- Audited `.env.production` by key without printing secrets. Added the live
  Render `API_URL`; generated valid high-entropy auth, revalidation and cron
  secrets plus a valid P-256 VAPID key pair. The gitignored file is the only
  local copy and none of its values entered source control.
- Expanded `docs/production-deployment-handoff.md` with the exact provider-owned
  values still required, the feature each one unlocks, current official pricing
  assumptions and the verified deployment state.
- Remaining launch inputs are external rather than invented: provider keys and
  approvals, real newsroom identities/content/programming, final domain/DNS,
  legal copy and named operational owners.

## 25. KUR-86 — adaptive VOD delivery for accessible video reports (2026-08-31)

**Status: DEPLOYED; real licensed video inventory remains a client input.**

- Added the provider-neutral Go `VideoDeliveryPort`. The Cloudinary adapter
  deterministically projects verified video originals into adaptive `sp_auto`
  HLS manifests and generated first-frame JPEG posters, while preserving the
  original URL as a safe fallback for non-Cloudinary assets.
- `ListGalleryLibrary` now owns that projection, so the HTTP route exposes only
  playback metadata and never provider transformation rules. Video publication
  still refuses any report without a ready synchronized-caption asset.
- The public gallery uses a resilient HLS.js/native-HLS VOD player with poster,
  captions, accessible failure copy and retry. Content Security Policy now
  permits the exact Cloudinary playback host for manifests and media segments.
- Full `pnpm verify` passes, including lint, types, boundaries, every package
  coverage floor, duplication, Go vet/race tests and 95% domain / 90%
  application coverage. Explicit Web and Studio production builds also pass
  against the deployed API.
- Commit `423d3f6` passed CI run `33437132914`, including Lighthouse and all 39
  browser/accessibility journeys. The stable public gallery and Studio gallery
  routes return HTTP 200, the API gallery endpoint returns HTTP 200, and the
  live Web CSP now contains the exact Cloudinary connect/media origins required
  for HLS manifests and segments.

## 26. KUR-87 — editor-approved article narration (2026-08-31)

**Status: DEPLOYED; provider activation remains.**

- Added a Go-owned narration job aggregate and use cases for request, polling,
  private review and explicit attachment. Jobs are pinned to the exact approved
  revision; changing approval invalidates stale audio.
- Added indexed Mongo persistence and an asynchronous provider port. The AWS
  adapter synthesizes supported English/French voices to private same-region S3,
  promotes the completed MP3 to Cloudinary and deletes the staging object only
  after successful promotion. Unconfigured providers and unsupported Twi fail
  closed.
- Studio exposes generate/retry state, animated disabled controls, private audio
  review and a separate publishing-editor approval action. The stable Studio
  cron now polls jobs every five minutes through the authenticated Go endpoint.
- Public articles expose only attached narration, use native audio controls,
  identify the voice as synthetic and link directly to the approved article
  body as the transcript.
- Commit `9534117` passed CI run `33444152054`: lint, type-check, boundaries,
  all TypeScript coverage floors, production builds, 39 browser/accessibility
  journeys, duplication, dependency audit, Lighthouse, secret scanning, Go
  vet/race/coverage, real-Mongo integration tests and vulnerability scanning.
  Render deploy `dep-daavj0u8bjmc739e94o0` is live on that exact commit. The
  stable Web home, OG image, Studio sign-in and API health aliases each return
  HTTP 200 in production.
- Activation inputs: `AWS_POLLY_OUTPUT_BUCKET`, least-privilege AWS credentials
  with Polly/S3 access, and the existing Cloudinary credentials. See
  [ADR-0013](docs/decisions/adr-0013-article-narration.md).

## 27. KUR-88 — recorded live replay handoff (2026-08-31)

**Status: DEPLOYED; provider activation remains.**

- Amazon IVS channel creation now fails closed unless
  `AWS_IVS_RECORDING_CONFIGURATION_ARN` is present, so an operator cannot start
  an ephemeral live channel that silently leaves no source recording.
- Go owns the replay boundary. A private authenticated query lists ended live
  slots still awaiting replay; publication refuses future, cancelled,
  prerecorded and already-completed slots and requires a ready video plus a
  ready `text/vtt` caption asset.
- Mongo supplies the id lookup and indexed ended-live queue. Studio exposes
  branded asset/slot selectors with disabled animated submission, and the
  public guide projects the immutable Cloudinary video through adaptive HLS,
  poster and synchronized captions into the shared resilient VOD player.
- Focused Go domain/application/HTTP suites, the IVS adapter suite, the Web-kit
  BFF suite, full lint, monorepo type-check, boundaries, duplication, both
  production builds and the focused real-Mongo repository test pass. Clean CI
  and production smoke evidence are recorded below.
- Activation input: a private IVS recording destination and its recording
  configuration ARN. Automated S3 recording promotion into Cloudinary remains
  the next R3 slice; this release deliberately keeps capture separate from the
  editor's accessibility and publication decision.
- Release evidence: implementation commit `f617b28`; CI run `33448531924`
  passed on its clean rerun, including all 39 browser/accessibility journeys,
  full coverage, real-Mongo integration, Go race/coverage/vulnerability gates,
  Lighthouse, duplication and dependency audit. Render deploy
  `dep-dab0dc15efls73fn442g` is live from the exact commit. The Studio
  production deployment is Ready at `kurasikapa-studio.vercel.app`; public
  home, Live, OG image, Studio sign-in and API health return 200, while both
  unauthenticated replay endpoints correctly return 403.

## 28. KUR-89 — automatic IVS recording promotion (2026-08-31)

**Status: DEPLOYED; provider activation remains.**

- A signed, size-bounded EventBridge `Recording End` endpoint accepts only one
  IVS channel ARN, the configured private source bucket, a safe `ivs/v1/`
  prefix, a positive duration and an `en:`/`fr:` channel name. Missing or wrong
  webhook credentials return 404 and never start paid provider work.
- Go persists `recording_imports` before starting MediaConvert. The unique IVS
  recording-session reference absorbs duplicate provider delivery, reserves
  the eventual media asset id, and leaves a failed start retryable.
- The provider reads IVS `recording-ended.json` instead of guessing rendition
  paths, submits the discovered HLS master to a configured HLS-to-MP4 template,
  polls asynchronously, promotes the deterministic private S3 output into
  Cloudinary and deletes only that temporary MP4. Original IVS HLS remains
  recoverable under the source-bucket lifecycle.
- A successfully promoted MP4 becomes a ready private video in the existing
  media library. It is not published automatically: Studio still requires an
  ended schedule slot and a separately ready WebVTT caption before replay
  publication.
- The five-minute GitHub schedule now processes recording jobs through a
  cron-authenticated Studio BFF. Domain, application, provider, HTTP and real
  Mongo repository tests pass; the new provider adapter is at 85.0% coverage,
  and the final local `make verify` reports 97.1% domain and 90.8%
  application/HTTP coverage.
- Activation inputs are intentionally absent from `.env.production`:
  `AWS_IVS_REGION`, `AWS_IVS_RECORDING_BUCKET`,
  `AWS_MEDIACONVERT_OUTPUT_BUCKET`, `AWS_MEDIACONVERT_ROLE_ARN`,
  `AWS_MEDIACONVERT_JOB_TEMPLATE`, `IVS_RECORDING_WEBHOOK_SECRET` and the
  Cloudinary credential trio. The exact provider setup and recovery process is
  in [recording-promotion.md](docs/operations/recording-promotion.md).
- Release evidence: implementation commits `2ba0f06` through `3b14d62`; CI
  run `33452498383` passed on its clean rerun, including all 39
  browser/accessibility journeys, full coverage, real-Mongo integration, Go
  race/coverage/vulnerability gates, Lighthouse, duplication and dependency
  audit. Render deploy `dep-dab17he7bikc73flfu2g` is live from exact commit
  `3b14d62`. Studio deployment `dpl_H8M31jpyNciBdYAgqnhwQndwGuEG` is Ready
  and attached to `kurasikapa-studio.vercel.app`; its sign-in returns 200 and
  its unauthenticated recording cron returns 404. The public Vercel alias
  returns 200 for Home, Live and OG image. API health returns 200, while both
  unauthenticated recording POST endpoints correctly return 404. The planned
  custom host `kurasikapa.tv` did not resolve during this smoke, so the Vercel
  alias remains the verified public endpoint until DNS is supplied.

## 29. KUR-90 — editor-owned voice-to-article (2026-09-01)

**Status: DEPLOYED; live microphone permission smoke remains operator-assisted.**

- The create-story workspace now exposes explicit start/stop English and French
  dictation with microphone and stop icons, a live interim transcript and clear
  microphone/browser failure states.
- `SpeechToTextPort` isolates the browser recognition API. Final segments append
  to the existing rich Markdown value in local browser state; interim text is
  display-only, and no recognised text reaches Mongo until the journalist
  reviews it and explicitly chooses `Create draft`.
- Unsupported browsers fail closed while retaining the complete manual rich
  Markdown workflow. The UI discloses that the browser speech service handles
  recognition; no new API credential or server-side microphone stream exists.
- ADR-0014 records the editor-before-persistence decision. The focused Studio
  suite passes 51 tests with 94.07% statements, 81.63% branches, 94.28%
  functions and 97.89% lines; Studio TypeScript checking is green.
- Full lint, type checking, dependency boundaries, duplication threshold, both
  production builds and Go verification pass. Go reports 97.1% domain and
  90.8% application/HTTP coverage.
- Release evidence: implementation commit `e1c494d`; CI run `33456436368`
  passed all TypeScript coverage floors, production builds, real-Mongo
  integration, Go race/coverage/vulnerability gates, Lighthouse, secret scan,
  39 browser/accessibility journeys, duplication and dependency audit. Vercel
  deployment `dpl_F76xh5BLahfLiekog6ZsYHFuXkut` is Ready and attached to
  `kurasikapa-studio.vercel.app`; the stable Studio sign-in and guarded
  create-story route both return HTTP 200.
- A live microphone permission check still requires an operator-controlled
  supported browser. The current Chrome extension connection was unavailable;
  no permission prompt was accepted or microphone data captured automatically.

## 30. KUR-91 — products and paid classifieds (2026-09-01)

**Status: DEPLOYED; live provider-checkout credential smoke remains.**

- Added revenue-domain product, product-order and classified lifecycles. A
  product requires accessible HTTPS imagery, valid GHS/EUR pricing and stock
  before activation. A classified must be paid, reviewed by a revenue manager
  and is then published for a bounded 30-day period.
- Added application ports/use cases, Mongo repositories and mandatory indexes.
  Stripe/Paystack checkout remains provider-neutral; signed webhooks confirm
  product orders or move classified submissions into the private review queue.
- Studio Revenue now manages shop inventory and approves paid classifieds.
  Public Shop and Classifieds pages provide inventory, accessible empty states,
  disabled loading controls and secure checkout redirects. The footer exposes
  both destinations.
- Domain tests now cover 99.1% of the revenue package; total Go domain coverage
  is 96.8%. Application/HTTP coverage meets the 90.0% floor, and the Web Kit
  suite passes 323 tests at 80.07% branch coverage.
- Release evidence: implementation commits `f317bb3` and `01dfdbf`; CI run
  `33459049572` passed Quality gates, Go service, Secret scan and Lighthouse.
  The production API health check and both read-only commerce endpoints
  (`/public/products`, `/public/classifieds`) return HTTP 200. Studio deployment
  `dpl_64GEy4A4HyMd2wo5bYUKqT8qXUb9` is Ready, and `/studio/en/revenue` returns
  HTTP 200 from `kurasikapa-studio.vercel.app`.
- The independent public Web deployment was attempted against project
  `prj_PdORywgPcFJ2DGAmQpP8bXtztouo`, but Vercel rejected it with
  `api-deployments-free-per-day` after the account exceeded 100 deployments in
  24 hours. The previous public deployment therefore still returns HTTP 404
  for `/en/shop` and `/en/classifieds` at that point; the recovery evidence
  below supersedes that temporary release state.
- Quota recovery evidence: Web deployment
  `dpl_364SDvbEqvHMkizmZbeiTePbvrZ4` reached Ready. The stable public alias now
  returns HTTP 200 for `/en/shop` and `/en/classifieds`; `/og-image` also
  returns HTTP 200. A real provider checkout remains intentionally unsubmitted
  until live Paystack/Stripe credentials and a controlled test purchase are
  approved.

## 31. KUR-92 — disclosed affiliate inventory (2026-09-01)

**Status: DEPLOYED.**

- Added permission-gated affiliate inventory with mandatory disclosure,
  accessible HTTPS imagery and an HTTPS-only destination. Activation is an
  explicit revenue-manager action.
- Public inventory intentionally excludes the outbound destination, internal
  commission note and click totals. A server-side follow command resolves the
  stored destination and atomically counts the anonymous click, preventing a
  caller from substituting an unapproved URL.
- Studio Revenue can create and publish partner recommendations and review
  aggregate follow counts. The public Partner Picks page shows disclosures at
  the decision point, has a useful animated empty state and disables all
  outbound controls while a tracked destination is being resolved.
- Verification: `pnpm verify` passes lint, type checking, dependency
  boundaries, 325 Web Kit tests at 80.48% branch coverage, 79 Web tests,
  duplication and the Go race/coverage/vulnerability gate. A cache-cleared Go
  run reports 96.8% domain and 90.8% application/HTTP coverage. A disposable Mongo 8 replica set
  proved all adapter integration suites, including named affiliate indexes,
  round-trip persistence and atomic click counting. Studio and Web production
  builds pass with the production environment; `/en/partners` and `/og-image`
  are present in the generated Web route manifest.
- Release evidence: implementation commits `b0233e9` and `92711b3`; CI run
  `33461189495` passed Quality gates, Go service, Secret scan and Lighthouse,
  including real-Mongo integration and browser accessibility journeys. Web
  deployment `dpl_364SDvbEqvHMkizmZbeiTePbvrZ4` and Studio deployment
  `dpl_EZ9adFURWVRJGAL3n9fuPyzhtmGW` are Ready. The stable aliases return HTTP
  200 for `/en/partners` and `/studio/en/revenue`; the Render health and
  `/public/affiliate-links` endpoints also return HTTP 200.
- Vercel lists `kurasikapa.tv` and `studio.kurasikapa.tv` as project aliases,
  but public DNS does not resolve either hostname yet. The deliberate
  `kurasikapa-web.vercel.app` and `kurasikapa-studio.vercel.app` aliases remain
  the verified production entry points until registrar DNS is configured.

## 32. KUR-93 — advertiser self-service and approval queue (2026-09-01)

**Status: API DEPLOYED; Web and Studio release blocked by Vercel daily quota.**

- Added an invitation-gated public advertiser workspace with its own password,
  MFA and forgot-password journey. Advertisers submit complete campaign
  creative, placement, schedule and budget requests and can see only their own
  history and review notes.
- Added a permission-gated Studio proposal queue. Revenue managers inspect the
  creative and destination, approve once to activate inventory, or return a
  proposal with a required explanatory note. Advertisers cannot approve their
  own requests.
- Added the Go domain lifecycle, application use cases, owner/manager repository
  queries, HTTP/BFF routes and Mongo persistence. Approval commits the proposal
  transition and new campaign in one transaction; optimistic status filters
  prevent repeat approval and duplicate campaigns.
- Verification before release: `pnpm verify` passes lint, type checking,
  boundaries, all coverage suites, duplication and Go race/vulnerability gates.
  Go reports 96.8% domain and 90.8% application/HTTP coverage. A disposable
  Mongo 8 replica set passes all adapter integration tests, including approval
  rollback and named proposal indexes. Both production builds pass and expose
  the advertiser portal and Studio Revenue routes.
- Release evidence: implementation commit `499a933` and replica-set CI repair
  `e601e99`; CI run `33463801312` passed Quality gates, Go service, Secret scan
  and Lighthouse, including every browser/accessibility journey and the real
  transactional Mongo suite. Render deploy `dep-dab3nr15efls73fq9hl0` is live
  from `499a933`; `/healthz` returns 200 and the unauthenticated proposal route
  correctly returns 403.
- Vercel refused the explicit Studio production release after upload with
  `api-deployments-free-per-day` because this account exceeded 100 deployments
  in 24 hours. The current public alias therefore still returns 404 for the new
  advertiser portal, while the existing Studio Revenue and `/og-image` routes
  return 200. Retry both independent Vercel releases after the quota window;
  do not describe KUR-93 as fully deployed until those exact builds are Ready.
