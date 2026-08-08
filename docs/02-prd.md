# 02 — Product Requirements

Feature inventory taken from the signed questionnaire. Every ticked item appears here with the release that delivers it. Nothing has been dropped.

---

## 1. Public pages (section 5 — all 27 selected)

| Page | Release | Note |
|---|---|---|
| Home | R1 | Designed — `kurasikapa_media_homepage_*` |
| News · Breaking News | R1 | Breaking uses a pinned rail + push in R2 |
| Politics · Business · Sports · Entertainment · Technology · Lifestyle · Health · Education | R1 | One category template, eight instances |
| Opinion · Editorial | R1 | Same template, distinct byline treatment |
| Article page | R1 | Designed — `kurasikapa_media_article_page_*` |
| About Us · Our Team · Contact · FAQ | R1 | Designed |
| Privacy · Terms · Cookies | R1 | GDPR-required |
| Advertise With Us · Careers | R1 | Static in R1, self-serve portal in R4 |
| Gallery | R2 | Image gallery |
| Videos · Live TV · Podcasts | R3 | Designed — `kurasikapa_media_live_tv_*`, `podcast_library_*` |
| Events | R3 | Designed — `kurasikapa_media_events_summits` |
| Custom pages | R1 | Page builder from the CMS |

The Stitch package covers roughly 70 of these screens across desktop, tablet and mobile in both themes. UI work in R1 is **implementation against an existing design**, not design.

---

## 2. User roles (section 8)

Eleven roles. Permissions are domain logic in `packages/domain/identity`, not UI conditionals.

| Role | Core capability |
|---|---|
| Super Admin | Everything, including role assignment and audit access |
| Administrator | Everything except role assignment |
| Editor | Approve, reject, publish, schedule, unpublish |
| Journalist | Draft, submit for review, edit own drafts |
| Author | Draft, submit for review — own content only |
| Photographer | Upload and manage image assets |
| Video Editor | Upload and manage video assets, manage streams |
| Social Media Manager | Compose, schedule and publish social posts |
| Advertiser | View own campaigns and reporting |
| Subscriber | Read premium content, bookmark, comment |
| Guest | Read public content |

**Invariant:** an Author may never publish. An Editor may never assign roles. Both are enforced in the entity, tested without a database, and re-checked in every Server Action.

---

## 3. Editorial workflow

```
Draft ──submit──▶ In Review ──approve──▶ Approved ──schedule──▶ Scheduled ──▶ Published
  ▲                   │                                                          │
  └──────reject───────┘                                              unpublish───┘
```

Every transition writes an audit entry and a revision. `RestoreRevision` appends forward; history is never rewound.

## 4. Publishing features (section 6 — all 16 selected)

Markdown editor · rich-text editor · AI news assistant · AI rewrite · AI grammar check · AI headlines ·
AI SEO suggestions · AI image suggestions · AI tags · AI summarise · AI translate · AI featured-image prompt ·
schedule publishing · drafts · revision history · autosave. **All R1.**

## 5. AI features (section 9 — all 14 selected)

Generate from prompt · generate from bullets · rewrite · fact-check suggestions · SEO optimisation ·
tone adjustment · click-worthy headlines · meta description · auto-tagging · auto-category detection ·
image prompt generator · translate — **R1**.
Voice to article · article to audio — **R3** (needs STT/TTS ports).

**Product rule:** every AI output is a proposal an editor accepts or discards. See [ADR-0005](decisions/adr-0005-ai-sdk-anthropic.md).

## 6. Social (section 10)

Facebook and Instagram confirmed. Publish immediately · schedule · per-platform caption ·
AI caption · AI hashtags · AI image resize · AI short summary. **R2.**
X, LinkedIn, Threads, TikTok, Telegram, WhatsApp Channel, YouTube Community and Pinterest are unconfirmed; `SocialPublishPort` is platform-agnostic so each is an adapter, not a redesign.

## 7. Remaining sections

| Section | Scope | Release |
|---|---|---|
| 11 Multimedia | Image/video gallery, podcast hosting, live streaming, compression, CDN, cloud storage | R3 |
| 12 Search | Global search, AI semantic search, trending, most-read, related, recommended | R1 lexical · R2 semantic |
| 13 Accounts | Registration, Google/Facebook/Apple/email login, saved articles, history, notifications, comments, likes, bookmarks | R1 auth · R2 activity |
| 14 Newsletter | Subscription, daily and weekly digest, breaking alerts | R2 |
| 15 Monetization | AdSense, banners, sponsored posts, membership, donations, premium articles, affiliate, classifieds | R4 |
| 16 Analytics | GA, AI dashboard, heatmaps, SEO reports, most-viewed, reader behaviour, revenue | R1 GA · R5 rest |
| 17 SEO | Sitemap, robots, schema.org, OpenGraph, Twitter cards, canonicals, meta, AI SEO | R1 |
| 18 Security | SSL, 2FA, CAPTCHA, role permissions, audit logs, backup, DR, WAF | R1 except WAF/DR → R5 |
| 19 Performance | CDN, image optimisation, lazy loading, caching, PWA offline, mobile-first | R1 except PWA → R2 |
| 20 Integrations | GA, Search Console, Cloudinary, YouTube, Mailchimp/Brevo/Resend, Stripe, Paystack, Flutterwave, Maps, RSS, widgets | R1–R4 by dependency |
| 21 Future | Native apps, AI anchor, AI podcast/video generator, AI voice, chatbot, reporter app, offline publishing, public API | R5 |

## 8. Non-functional requirements

| Requirement | Target | Verified by |
|---|---|---|
| LCP (article page, 4G) | < 2.0s | Lighthouse CI on every PR |
| INP | < 200ms | Lighthouse CI |
| Uptime | 99.9% | Uptime monitor + alerting |
| Accessibility | WCAG 2.2 AA | axe in Playwright, on all eight journeys |
| Locales at launch | EN, FR | E2E journey 1 |
| Breaking news to live | < 60s from approval | Server Action + `updateTag`, measured |
| Data residency | EU | Atlas EU region |
