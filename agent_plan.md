# agent_plan.md — what is built, what is available, what is next

> **Status doc, not a design doc.** Every claim here was verified against the
> repository on 2026-08-08 at `1276bef`. Where something is *not* built, it says
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
| HEAD | `1276bef` — KUR-25 |
| Commits | 25 (`KUR-1` … `KUR-25`) |
| Unit tests | 569 passing — domain 177 · application 171 · adapter-mongo 80 · adapter-anthropic 27 · web 114 |
| E2E | 25 Playwright journeys + 4 axe WCAG 2.2 AA checks, all passing |
| Gates | `lint` 0 · `typecheck` 0 · `boundaries` 0 · `jscpd` 0.26% · `next build` 0 |
| Deployed | **No.** Nothing is on Vercel or Render yet. Local only. |

Run `pnpm verify` before claiming any task is done. It runs the gates in CI order.

---

## 2. The shape of the system

Two deployable hexagons over one MongoDB cluster.

```
packages/domain          zero dependencies — business rules and invariants
packages/application     use cases + port interfaces — imports domain only
packages/adapter-mongo   MongoDB implementations of the repository ports
packages/adapter-anthropic  AiPort via the AI SDK
packages/ui              presentational components
apps/web                 Next.js 16 — public site + editorial studio
services/media-svc       EMPTY DIRECTORY. Go service, not started.
```

`apps/web/src/composition/` is the only place allowed to import an `adapter-*`.
dependency-cruiser enforces this; the rule is `composition-root-is-the-only-door`
and it has been probe-tested.

Seven bounded contexts: `editorial` · `identity` · `media` · `distribution` ·
`audience` · `revenue` · `insight`. Only the first four exist in code —
`media`, `revenue` and `insight` are named in the architecture but have no files.

---

## 3. What is DONE

### 3.1 Domain (`packages/domain`)

| Context | Files | Holds |
|---|---|---|
| `editorial` | `article.ts`, `article-status.ts`, `revision.ts`, `category.ts`, `errors.ts` | Slug freezes after first publication; the Draft→Review→Approved→Scheduled→Published transition table with per-transition permissions; append-only revisions (restore writes *forward*); per-locale category slugs |
| `identity` | `actor.ts`, `role.ts`, `role-assignment.ts` | 11 roles → permission mapping; self-assignment refused even for super_admin |
| `audience` | `bookmark.ts` | Refuses to save an unpublished article |
| `distribution` | `social-post.ts` | Refuses unpublished articles; 5-attempt retry budget |
| `shared` | `ids.ts`, `slug.ts` | Branded ids; Unicode-aware slugs (handles Twi ɛ/ɔ) |

### 3.2 Application (`packages/application`) — 23 use cases

- **editorial (16)** — CreateDraft, UpdateDraft, GetDraft, GetPublishedArticle,
  SubmitForReview, ApproveArticle, RejectArticle, SchedulePublication,
  PublishArticle, PublishDueArticles, UnpublishArticle, ListAuthoredArticles,
  ListAwaitingReview, ListPublishedArticles, BrowseCategory, ListSections
- **identity (3)** — ResolveActor, AssignRoles, ListUsers
- **audience (4)** — SaveArticle, RemoveSavedArticle, ListSavedArticles, SearchArticles
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
| RoleRepository | `MongoRoleRepository` | wired |
| UserDirectory | `MongoUserDirectory` | wired — **the only file that reads Better Auth's `user` collection** |
| SearchPort | `MongoTextSearch` | wired — `$text`, *not* Atlas Search (can't run in a Testcontainer) |
| AiPort | `AnthropicAiAdapter` | wired — 12 methods, cost-routed opus/sonnet/haiku |
| SocialPostRepository | `MongoSocialPostRepository` | **built but never instantiated in the container** |
| ClockPort / IdPort / EventBusPort | object literals in `composition/ambient.ts` | wired — event bus is in-process, synchronous, no delivery guarantee |

Adapter tests run against **real MongoDB via Testcontainers**, never a mocked driver.

### 3.4 Public site (`apps/web/app/[locale]/`)

`/` · `/articles/{slug}` · `/sections/{slug}` · `/search` · `/profile` ·
`/sign-in` · `/about` · `/team` · `/contact` · `/faq` · `/advertise` ·
`/careers` · `/legal/{privacy|terms|cookies}` · `/sitemap.xml` · `/robots.txt`

### 3.5 Editorial studio (`apps/web/app/[locale]/studio/`)

`/studio` (drafts) · `/studio/articles/{id}` (editor + autosave + AI panel) ·
`/studio/review` (approval queue) · `/studio/people` (role assignment)

Guarded by `studio/layout.tsx`, which wraps `children` rather than checking
above them — see the Suspense rule in CLAUDE.md.

### 3.6 Server Actions (`apps/web/src/actions/`)

- `editorial.ts` — createDraft, updateDraft, submitForReview, approve, reject,
  schedule, publish, unpublish, assignRoles, toggleSaved
- `ai.ts` — suggestHeadlines, suggestSeo, suggestTags, summarise, factCheck,
  imagePrompt, detectCategory
- All inputs validated by Zod schemas in `schemas.ts`; all return `ActionResult`.

### 3.7 Design fidelity

Extracted Stitch screens live in `design/screens/`. Four are real:

| Design file | Implemented against it? |
|---|---|
| `homepage.html` | ✅ KUR-24 |
| `kurasikapa_media_article_page.html` | ✅ KUR-25 |
| `kurasikapa_media_category_listing.html` | ❌ **not yet — section page uses my own layout** |
| `kurasikapa_admin_editorial_cms.html` | ❌ **not yet — studio uses my own layout** |
| `kurasikapa_media_homepage.html` | 0 bytes — empty export, ignore |

The full 50MB `stitch_kurasikapa_ai_media_platform.zip` (~70 screens) is at the
repo root and is **not** in Git LFS. Design-system docs are in `design/systems/`;
the chosen one is **Regal Precision**.

---

## 4. AVAILABLE but not reachable — pick these up first

These are the cheapest wins in the repo. The capability is built and tested; only
the wiring is missing.

| Capability | Where it lives | What's missing |
|---|---|---|
| **`AiPort.translate()`** | `adapter-anthropic` — implemented and tested | No Server Action, no UI. Locale is data (ADR/product rule 3), so translating creates a *new article document*. Highest-value gap: the site is bilingual by design and there is no way to produce the French version from the English one. |
| **`AiPort.draftFromPrompt` / `draftFromBullets`** | implemented, streaming | `/api/ai/[task]` route exists; the studio editor does not offer "generate". |
| **`PublishDueArticles`** | use case + container key `publishDueArticles` | Nothing calls it. Scheduling writes a `scheduledAt` that **nothing ever acts on** — an article scheduled today will never publish. Needs a cron (Vercel Cron or media-svc). |
| **`QueueSocialPost` / `PublishDuePosts`** | use cases built, KUR-22 | `MongoSocialPostRepository` is never instantiated in `container.ts`; no admin queue screen; no `SocialPublishPort` adapter. |
| **Revision history** | domain + repository are append-only and complete | No UI anywhere. The data is being written and never shown. |
| **`ListUsers` beyond roles** | works | Only used by the roles screen. |

---

## 5. NOT built

### 5.1 R1 remainder — needed to actually close R1

| Item | State |
|---|---|
| **Deployment to Vercel + Render** | Not done. R1's exit criterion says "on production". |
| **Audit logs** | Not built. Only the *permission name* `audit:read` exists — there is no audit collection, no use case, no writer. Product rule 4 (append-only audit) is currently unenforced because there is nothing to enforce it on. |
| **Rich-text editor** | Not built. `editor-fields.tsx` is a plain `<textarea>`. No tiptap/lexical/prosemirror. `ArticleBody` splits on blank lines rather than parsing Markdown — deliberately, since rendering stored HTML without a sanitiser is an injection route. |
| **Security headers** | `apps/web/proxy.ts` sets **no** CSP, HSTS, X-Content-Type-Options or Referrer-Policy. Docs claim these; the file does not have them. |
| **Rate limiting** | Not built — on auth, search, or the AI endpoints. |
| **2FA** | Not built. |
| **CAPTCHA** | Not built. |
| **Google Analytics / Search Console** | Not built. No gtag, no GTM. |
| **Scheduling actually firing** | See §4 — `PublishDueArticles` has no caller. |
| **Category listing + CMS screens** | Built, but against my layouts rather than the supplied designs. |
| **Error tracking, backups** | Not configured. |

### 5.2 R2 — Audience & Distribution

Domain for saved articles and social posts exists (§3). Everything else is open:
reader comments + moderation (**no domain files at all**), likes, reading history,
newsletter with double opt-in and digests, breaking-news alerts, push
notifications, Facebook + Instagram publishing (needs a `SocialPublishPort`
adapter and Meta app review), RSS in/out, trending / most-read / related /
recommended (needs `EmbeddingPort` — **declared, no adapter**, and Atlas Vector
Search), PWA offline reading.

### 5.3 R3 — Multimedia

Nothing built. Mux integration, live TV page, VOD library, video and image
galleries, podcast library with chapters and transcripts, media asset library,
article-to-audio (TTS), voice-to-article. The `media` bounded context has no files.

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

**Third-party credentials not yet available:** Mux (R3), Stripe + Paystack (R4),
Meta Graph API and app review (R2 social publishing).

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

1. **Wire scheduled publishing to a cron.** `SchedulePublication` currently
   writes a promise the system never keeps — an editor can schedule an article
   and it will silently never publish. This is a correctness bug wearing a
   feature's clothes, and the use case already exists.
2. **Expose `AiPort.translate()` as a Server Action + studio control.** The site
   is bilingual by design, the adapter is built and tested, and there is no way
   to produce the French document today.
3. **Rework the category listing and CMS screens against their `code.html`.**
   The two remaining supplied designs, following KUR-24 and KUR-25.

Then close R1 properly: security headers, rate limiting, audit logging, and a
first deployment.
