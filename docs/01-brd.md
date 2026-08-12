# 01 — Business Requirements

**Client:** Kurasikapa Media TV · BN511671125 · 4 Rue des Lys, 95190 Goussainville, France
**Industry:** Television, radio and online media services · 1 year in operation
**Delivery partner:** Neurodyne Technologies
**Source:** Website Discovery & Requirements Questionnaire, signed 2026-08-06

---

## 1. The business

Kurasikapa Media TV produces television and digital content intended to educate, motivate and entertain. The organisation describes media as "a tool for empowerment, education and social impact" rather than entertainment alone, and its stated values are **respect, integrity, creativity and excellence**.

**Mission** — bring the best experience to viewers through educational, motivational and social content.
**Vision** — become a leading global brand known for creativity, quality and empowerment.

Two facts shape the build more than anything else in the questionnaire:

1. **It is a television station, not a blog.** Live TV, video and podcasts are identity, not add-ons.
2. **It is France-registered with an African audience.** That makes GDPR mandatory, multi-currency real (EUR and GHS), and multilingual delivery a first-class requirement rather than a Phase 5 nicety.

---

## 2. Business objectives

All eleven goals in section 4 of the questionnaire were selected. Grouped by what they actually demand of the platform:

| Objective | What the platform must do | Release |
|---|---|---|
| Publish news · Increase readers · Build trust | Fast, credible, multilingual publishing with editorial review | R1 |
| Newsletter growth | Double opt-in, digests, breaking alerts | R2 |
| Podcast distribution | Hosted audio with player, chapters, RSS | R3 |
| Live streaming | Owned live TV playback | R3 |
| Advertising revenue · Sell advertisements | Ad management, placements, advertiser reporting | R4 |
| Memberships · Sell products · Accept donations | Subscriptions, entitlement, payments in EUR and GHS | R4 |

"Build trust" is the one objective with no single feature behind it. It is delivered by the editorial workflow, the fact that no AI output publishes without human approval, correction and revision history, and named bylines.

---

## 3. Audience and languages

Global, with concentration in Ghana and the French diaspora.
**Launch locales:** English, French. **Configurable:** local languages, added as data without a deploy.

Consequence: locale is modelled at the article level with independent publish state per language. See [04-data-model.md](04-data-model.md#1-the-one-decision-that-shapes-everything-translations).

---

## 4. Brand assets

| Asset | Status | Action |
|---|---|---|
| Logo | Provided | In the Stitch package |
| Colour palette | Provided | Formalised as "Regal Precision" — navy + champagne |
| Videos | Provided | Cloudinary VOD + Amazon IVS live at R3 |
| Brand guidelines | **Missing** | Derived from the Stitch design systems; needs client confirmation |
| Typography | **Missing** | Playfair Display + Outfit, from the design set |
| Icons, photography | **Missing** | Material Symbols + a licensed stock account required |

**Open item for the client:** a stock photography licence and an icon decision. Neither blocks R1; both block the R1 sign-off review, because placeholder imagery on a media house homepage will not pass UAT.

---

## 5. Constraints

- **GDPR** — EU data residency (Atlas EU region), consent for analytics and marketing, right to erasure across reader activity collections, 400-day retention cap on page views.
- **Accessibility** — WCAG 2.2 AA. Non-negotiable for a public-service-oriented media brand and increasingly a legal requirement in the EU.
- **Editorial integrity** — no AI-generated content publishes without a named human approver. Recorded in the audit log.
- **Process** — the Neurodyne 12-phase SDLC governs delivery, with client approval gates at Phases 2, 8 and 11.

---

## 6. Not yet answered

These were left blank in the questionnaire and are tracked as open:

1. Preferred domain name.
2. Desired launch date and budget range (sections 24) — the roadmap is currently sequenced by dependency, not by a date.
3. The specific local languages to support beyond EN/FR.
4. Existing website and current CMS, if any — determines whether content migration is in scope.
5. Named advertiser contracts, which set the ad-serving requirements in R4.

None block R1. Items 3 and 4 must be closed before the R2 planning gate.
