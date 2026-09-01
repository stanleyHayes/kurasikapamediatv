# 06 — Release Roadmap

**Scope commitment:** everything ticked in the signed questionnaire ships. Nothing is cut.
**Delivery shape:** five releases, each ending at a client sign-off gate — which is what the Ops Manual (Phase 8 UAT → Phase 11 Sign-Off) already requires.

The honest number: full scope is a **9–14 month** build. Sequencing it is what makes that survivable.

---

## R1 — Foundation & Publishing  *(the platform is real)*

| Area | Ships |
|---|---|
| Platform | Turborepo, hexagon skeleton, CI, quality gates, Atlas cluster, Vercel + Render projects |
| Public | Home, Category listing, Article page, Global search, About, Team, Contact, legal pages |
| i18n | EN + FR routing, per-locale articles, locale switcher |
| CMS | Markdown + rich-text editor, autosave, drafts, revision history, scheduling |
| Workflow | Draft → Review → Approved → Scheduled → Published, with rejection paths |
| Identity | Auth.js v5, Google/Facebook/Apple/email, 11 roles, permission model, 2FA |
| AI | Rewrite, grammar, headlines, SEO suggestions, tags, auto-category, summarise, meta description |
| SEO | Sitemap, robots, schema.org, OpenGraph, Twitter cards, canonicals |
| Ops | Audit logs, backups, error tracking |

**Exit:** an editor writes, an approver approves, a reader reads — in two languages, with AI assistance, on production.

---

## R2 — Audience & Distribution  *(the platform grows)*

Reader accounts · saved articles · reading history · comments + moderation · likes · bookmarks ·
newsletter (double opt-in, daily + weekly digest) · breaking-news alerts · push notifications ·
social auto-publishing to Facebook + Instagram with AI captions, hashtags and per-platform scheduling ·
RSS import + syndication out · trending / most-read / related / recommended (Atlas Vector Search) ·
PWA offline reading.

**Exit:** the newsroom publishes once and reaches every channel.

---

## R3 — Multimedia  *(the TV station comes online)*

Amazon IVS live broadcast + real-time stages · Cloudinary VOD / podcast / image library ·
video gallery · podcast library with player, chapters and transcripts · image gallery ·
media asset library with optimisation and CDN · article-to-audio (TTS) · voice-to-article.

**Exit:** Kurasikapa broadcasts on its own property, not someone else's platform.

---

## R4 — Revenue  *(the platform pays for itself)*

Membership tiers · premium/paywalled articles with domain-level entitlement ·
donations · Stripe (EUR) + Paystack (GHS) · ad management dashboard · banner and sponsored placements ·
AdSense · classifieds · affiliate links · advertiser self-serve portal · revenue dashboard.

**Exit:** four independent revenue lines are live and measurable.

---

## R5 — Intelligence & Reach  *(the platform compounds)*

AI analytics dashboard with engagement insight · SEO Center · heatmaps · reader-behaviour reports ·
AI news anchor · AI podcast generator · AI video generator · AI chatbot ·
versioned public news API (implemented in KUR-100) ·
public REST + GraphQL API · mobile reporter app · native iOS + Android · offline publishing ·
Events/Summits module · WAF · executable DR restore verifier and runbook
(implemented; provider drill evidence pending) · full pen-test.

**Exit:** the questionnaire is closed, including section 21 "Future Features".

---

## Sequencing rules

1. **No release starts before the previous one is signed off.** Ops Manual Phase 11.
2. **Every release carries its own QA → Staging → UAT → Beta → Production run.** Phases 6–10, unabridged.
3. **The data model absorbs all five releases from day one.** Collections for revenue and media exist in R1 as empty, indexed and documented — schema churn in month 8 is the failure mode that kills this class of project.
4. **A feature moves forward only with its tests.** See [07-quality-gates.md](07-quality-gates.md).

## Jira mapping

Per the Training Manual: `Client → Project → Epic → Story → Subtask`.
Each release above is a **Fix Version**. Each row within it is an **Epic**. Branches follow
`feature/KUR-123-short-name`, commits `KUR-123 <imperative>`, PRs `KUR-123 <Title>`.
