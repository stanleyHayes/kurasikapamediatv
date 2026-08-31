# Production deployment handoff

Prepared 31 August 2026. Prices are USD, exclude tax and foreign-exchange fees,
and must be rechecked at purchase. “Mid” is a credible launch setup; “high” is
a growth budget, not an enterprise quote.

## Environment audit completed

The gitignored `.env.production` is the single updated local handoff file. It
now contains the deployed Render `API_URL` plus newly generated, independent
values for `BETTER_AUTH_SECRET`, `REVALIDATE_SECRET`, `CRON_SECRET` and the
VAPID public/private key pair. Their values are deliberately not repeated in
this document or source control.

The ignored `apps/web/.env.production` and `apps/studio/.env.production` files
are older developer placeholders and must not be used as deployment inputs.
Either remove them locally or inject the audited root file into local production
builds; provider dashboards remain the source of truth for deployed values.

The following provider-issued values are still required before their matching
features can be enabled. Do not upload blank entries to Vercel or Render:

| Provider / owner | Values still to provide | What remains disabled |
|---|---|---|
| Google Cloud | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| Meta | Facebook OAuth pair plus `META_APP_ID`, `META_APP_SECRET`, Page token, Page ID and Instagram user ID | Facebook/Instagram sign-in and publishing |
| Apple Developer | Services ID, Team ID, Key ID and `.p8` private key | Apple sign-in |
| Resend | `RESEND_API_KEY` and verified sending-domain DNS | Invitations, password reset, newsletters, alerts and contact mail |
| Cloudinary | cloud name, API key and API secret | Production uploads, article photography, VOD and podcast assets |
| AWS | IVS IAM pair; separate Polly/S3 IAM pair, London region and private output bucket | Live channels and article narration |
| Paystack / Stripe | live secret keys and webhook signing secret | Real donations, membership payment and reconciliation |
| Cloudflare | Turnstile site key and secret | Production CAPTCHA |
| Google Analytics | GA4 measurement ID | Consent-gated audience analytics |
| SonarCloud | organization token, if private analysis is wanted | Hosted code-quality reporting only |

`MONGODB_URI` and `ANTHROPIC_API_KEY` are present locally. Rotate either one if
it has ever been shared outside the password manager. The legacy two-field
Apple entries have been removed from the handoff; the four-value Apple setup
above is the one the code uses. Missing provider values remain commented so
they cannot accidentally be uploaded as blank production variables.

## What you need to provide

### Ownership and access

- A company-owned email address and password-manager vault.
- Owner/admin access to GitHub, both Vercel projects, Render, MongoDB Atlas,
  Cloudinary, AWS, Resend, Cloudflare, Google, Meta, Paystack and Stripe.
- A billing card and billing contact for every paid provider.
- The final public domain. Until its DNS resolves, the public host is
  `kurasikapa-web.vercel.app` and Studio is
  `kurasikapa-studio.vercel.app/studio`.
- DNS access when the domain is purchased. Preferred final shape:
  `www.<domain>` or `<domain>` for readers and `studio.<domain>/studio` for staff.

### Credentials and provider approvals

- MongoDB Atlas production cluster, database user and IP/network policy.
- Render API service URL after `/healthz` passes.
- Cloudinary cloud name, API key and secret.
- AWS account, least-privilege IVS IAM user, approved IVS quotas and billing
  alarms. Add a separate least-privilege Polly/S3 principal and private London
  staging bucket with a short lifecycle policy for article narration. Never
  provide the AWS root credentials.
- Resend API key plus a verified sending domain and DNS records. The application
  currently sends as `news@kurasikapa.tv`; this must change if another domain is
  selected.
- Paystack Ghana live secret and completed business/KYC settlement setup.
- Stripe live secret and webhook signing secret if international Stripe payment
  support is required. Confirm Stripe account eligibility for the operating
  entity before launch.
- Google OAuth client ID/secret and approved redirect URIs.
- Facebook app ID/secret and completed app review.
- Apple Services ID, Team ID, Key ID and the `.p8` private key. The old
  `APPLE_CLIENT_ID`/`APPLE_CLIENT_SECRET` pair is not used by this application.
- Meta Page access token, Page ID and Instagram user ID, plus publishing review.
- Cloudflare Turnstile production site key and secret.
- Google Analytics measurement ID; Search Console property ownership and a
  named person responsible for indexing alerts.
- Anthropic API key, prepaid credits and a monthly spending ceiling.
- Generated VAPID public/private key pair for browser push.
- GitHub Actions `CRON_SECRET`, identical to Studio and API, and
  `ENABLE_SOCIAL_CRON=true` only after Meta review.

### Business, editorial and legal material

- Registered publisher name, registration number, physical address, phone,
  newsroom email, privacy contact and payment settlement details.
- Final logo files (SVG and transparent PNG), favicon, brand colours, social
  handles and a 1200 x 630 default social image.
- Named journalists and presenters with role, biography, portrait, social links
  and written consent to publish.
- At least 8–12 launch stories with original copy, headline, excerpt, category,
  author, hero image, caption/credit, dates and review approval.
- A seven-day programme schedule, programme descriptions, presenter assignments,
  live stream plan and replay rights.
- Initial videos, podcast episodes and galleries with titles, descriptions,
  thumbnails, rights/credits, captions or transcripts and publication approval.
- Membership tiers, donation wording, refund/cancellation policy, ad rate card,
  inventory rules, sponsored-content policy and tax treatment.
- Privacy policy, terms, cookie policy, editorial standards, corrections policy,
  complaints process, accessibility statement and copyright/takedown contact,
  reviewed by qualified Ghanaian counsel.
- A launch owner, on-call contact, editor-in-chief and named approvers for access,
  publishing, finance and incident response.

## Environment deployment map

Use `.env.production` as the key checklist, but store secrets in provider
dashboards—not Git. The same file cannot supply `APP_URL` to two independent
projects: use the public URL in the Web project and
`https://kurasikapa-studio.vercel.app` in Studio. `SITE_URL`, `STUDIO_URL`,
database/auth/revalidation secrets and the API URL are shared. Do not set
`COOKIE_DOMAIN` while the two apps use unrelated `vercel.app` hosts.

An unset optional value must be absent, not `KEY=""`; empty URL values fail
runtime validation. Rotate any credential that has ever been pasted into chat,
a ticket, source control or a screen recording.

## Monthly operating budget

| Service | Mid/month | High/month | Assumption |
|---|---:|---:|---|
| Vercel | $20 | $150 | One Pro developer seat can own both projects; high adds another developer seat, traffic and observability allowance |
| Render API | $25 | $170 | One 1 CPU/2 GB service vs two 2 CPU/4 GB services for availability |
| MongoDB Atlas | $58 | $394 | M10 vs M30, before backup/network overage |
| Cloudinary | $99 | $249 | Plus vs Advanced media plan |
| Resend | $20 | $90 | Pro 50k vs Scale 100k transactional emails |
| Anthropic | $50 | $300 | Editorial-assistance spending cap; usage based |
| AWS IVS/live + narration | $250 | $2,000 | Working allowance; live is driven by viewer-hours; narration is usage-based and comparatively small |
| Monitoring/DNS/domain | $25 | $150 | DNS can be free; includes domain amortisation and observability allowance |
| Contingency | $110 | $526 | About 20% for bandwidth, backups, tax and usage variance |
| **Estimated total** | **$657/month** | **$4,029/month** | Excludes salaries, production gear, legal work and payment fees |

The high Atlas figure uses the published M30 base rate of $0.54/hour (about
$394 over a 730-hour month). The mid figure uses M10 at $0.08/hour (about $58).
Live cost is the least predictable line: AWS charges input and viewer output
separately. Standard input is $2/hour; the first 10,000 HD viewer-hours in
Europe are $0.072/hour, while Ghanaian viewers may be billed through another
delivery region. Set an AWS Budget alert before the first public broadcast.
Polly narration is billed per synthesized character and S3 holds only temporary
private output before Cloudinary promotion; set a lifecycle rule even though a
successful promotion deletes its staging object immediately.

Paystack is not included in the fixed total. Ghana pricing is 1.95% per local
or international transaction, with no integration or maintenance fee; transfers
are additionally GHS 1 to mobile money or GHS 8 to bank accounts. Stripe is also
transactional rather than fixed; its displayed US standard rate is 2.9% + $0.30,
but the applicable rate and eligibility depend on the legal account country.

## Purchase references

- [Vercel pricing](https://vercel.com/pricing)
- [Render pricing](https://render.com/pricing)
- [MongoDB Atlas pricing](https://www.mongodb.com/pricing)
- [Cloudinary pricing](https://cloudinary.com/pricing)
- [Resend pricing](https://resend.com/pricing)
- [Amazon IVS pricing](https://aws.amazon.com/ivs/pricing/)
- [Amazon Polly pricing](https://aws.amazon.com/polly/pricing/)
- [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Paystack Ghana pricing](https://paystack.com/gh/pricing)
- [Stripe pricing](https://stripe.com/pricing)

## Production acceptance gate

- All required production keys exist in the correct provider and preview keys
  are not copied into Production.
- Web, Studio and API deploy successfully; `/healthz` passes.
- Sign-in, MFA, forgot-password, invitation and sign-out work on Studio's host.
- Draft → review → approval → publish updates the public site immediately.
- Article media, captions, email, push, scheduled publishing and social delivery
  pass smoke tests with real provider accounts.
- Donation/payment webhooks are verified, idempotent and reconciled in live mode.
- Sitemap, news sitemap, robots, canonical URLs, OG image and structured data use
  the final public host; Search Console accepts both sitemaps.
- Backups, spend alerts, error alerts, least-privilege access, key rotation and a
  rollback owner are documented and tested.
- Real content and team profiles replace all launch/demo empty states before the
  URL is shared publicly.

## Verified deployment state — 31 August 2026

- Public Web deployment `dpl_CreKjs4YCFhLkTDct1mTpFZCqNpt` is Ready and the
  stable Vercel alias serves `/og-image` as `200 image/png` without redirecting
  through a locale.
- Studio sign-in and the public Team route return HTTP 200; the Render API
  `/healthz` endpoint reports healthy.
- The API's public newsroom-profile endpoint is deployed and returns HTTP 200.
  The empty profile list is expected until approved journalist identities and
  portraits are supplied and published from Studio.
- `kurasikapa.tv` is attached to the Web project but does not currently resolve
  in DNS. Do not use it in launch announcements until DNS and TLS checks pass.
- Vercel currently builds with Node 24.x while the repository requests Node
  26+. The build succeeds, but the Web and Studio project settings should move
  to Node 26 when Vercel offers it, or the repository engine should be aligned
  deliberately after full verification.
