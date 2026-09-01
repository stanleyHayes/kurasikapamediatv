# Production deployment handoff

Prepared 1 September 2026. Prices are USD, exclude tax and foreign-exchange fees,
and must be rechecked at purchase. “Mid” is a credible launch setup; “high” is
a growth budget, not an enterprise quote.

## Environment audit completed

The gitignored `.env.production` is the single updated local handoff file. It
contains the deployed Render `API_URL`, the correct independent Vercel hosts,
and every currently known variable consumed by the Web, Studio, Go API and
enabled provider integrations, including variables intentionally left commented
until their provider is activated. Because this local file may contain usable
credentials, never send it through chat, email or a ticket. Generate or retrieve
each missing value directly in the relevant provider/password manager, then
upload it to the deployment dashboard without putting it in source control.

The ignored `apps/web/.env.production` and `apps/studio/.env.production` files
are older developer placeholders and must not be used as deployment inputs.
Either remove them locally or inject the audited root file into local production
builds; provider dashboards remain the source of truth for deployed values.

The audit also corrected `AWS_REGION` to `eu-west-1`. Studio uses this variable
to create IVS channels, so it must match the Ireland recording configuration and
private recording bucket used by the Render promotion pipeline. A mixed-region
setup fails when Studio tries to attach the recording configuration.

The following provider-issued values are still required before their matching
features can be enabled. Do not upload blank entries to Vercel or Render:

| Provider / owner | Values still to provide | What remains disabled |
|---|---|---|
| Google Cloud | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| Meta | Facebook OAuth pair plus Page token, Page ID and Instagram user ID; keep the app ID/secret in Meta's dashboard | Facebook/Instagram sign-in and publishing |
| Apple Developer | Services ID, Team ID, Key ID and `.p8` private key | Apple sign-in |
| Resend | Verified sending-domain DNS; the API key is configured and `onboarding@resend.dev` is the temporary sender | Branded sender only; transactional delivery is active |
| Cloudinary | No credential gap; production credentials are configured and authenticated | Licensed client media inventory only |
| Live origin / Bunny | Linux host, origin DNS, Bunny Pull Zone and CDN hostname, plus generated OME API/signing secrets | Self-hosted live transmission |
| AWS | Separate Polly/S3 IAM pair for narration; IVS credentials are optional fallback only | Article narration and optional managed live fallback |
| Paystack / Stripe | live secret keys and webhook signing secret | Real donations, membership payment and reconciliation |
| Cloudflare | Turnstile site key and secret | Production CAPTCHA |
| Google Analytics | GA4 measurement ID | Consent-gated audience analytics |
| Voyage AI / MongoDB Atlas | `VOYAGE_API_KEY` plus a READY 1,024-dimension `article_semantic_vector` index | Semantic search and related reporting; lexical/category fallbacks remain live |
| SonarCloud | organization token, if private analysis is wanted | Hosted code-quality reporting only |

The previously stored Atlas, authentication, revalidation, cron, Anthropic and
VAPID values must be rotated before launch because they have been exposed
outside the password manager. The legacy two-field Apple entries have been
removed from the handoff; the four-value Apple setup above is the one the code
uses. Missing provider values remain commented so they cannot accidentally be
uploaded as blank production variables.

## What you need to provide

### Ownership and access

- A company-owned email address and password-manager vault.
- Owner/admin access to GitHub, both Vercel projects, Render, MongoDB Atlas,
  Cloudinary, AWS, Resend, Cloudflare, Google, Meta, Paystack, Stripe and Voyage.
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
- A Linux host with at least 8 modern CPU cores, 16 GB RAM, fast SSD storage and
  adequate outbound transfer; point an origin hostname at it and deploy
  `deploy/ovenmedia/compose.yaml`. Create a Bunny Pull Zone using the HTTPS
  origin, attach the public live hostname and set the six `OVENMEDIA_*` values
  on Studio. Keep ports 8081 and the recording volume private.
- Add a separate least-privilege Polly/S3 principal and private London
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

### Exact provider placement

| Target | Required production variables | Add when the provider is activated |
|---|---|---|
| Vercel Web | `MONGODB_URI`, `MONGODB_DB`, `DEFAULT_LOCALE`, `BETTER_AUTH_SECRET`, Web `APP_URL`, `SITE_URL`, `STUDIO_URL`, `REVALIDATE_SECRET`, `CRON_SECRET`, `API_URL`, `CONTACT_TO_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Google/Facebook/Apple OAuth, Resend, Turnstile, GA4 |
| Vercel Studio | `MONGODB_URI`, `MONGODB_DB`, `DEFAULT_LOCALE`, `BETTER_AUTH_SECRET`, Studio `APP_URL`, `SITE_URL`, `STUDIO_URL`, `REVALIDATE_SECRET`, `CRON_SECRET`, `API_URL`, `ANTHROPIC_API_KEY`, `CONTACT_TO_EMAIL`, `LIVE_VIDEO_PROVIDER=ovenmedia`, all `OVENMEDIA_*` values | Resend, Meta Page token/IDs; IVS values only for fallback |
| Render API | `MONGODB_URI`, `MONGODB_DB`, `CRON_SECRET`, Cloudinary credential trio | Stripe/Paystack; separate Polly/S3 `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`; Voyage key/model/dimensions after the Atlas vector index is READY |
| GitHub Actions | `CRON_SECRET` | `ENABLE_SOCIAL_CRON=true` only after Meta approval |

For independent `vercel.app` hosts, leave `COOKIE_DOMAIN` absent. `SITE_URL` is
`https://kurasikapa-web.vercel.app`; `STUDIO_URL` is
`https://kurasikapa-studio.vercel.app/studio`; Studio's own `APP_URL` omits the
`/studio` base path. Never upload `AWS_SECRET_ACCESS_KEY`, payment secrets,
`ANTHROPIC_API_KEY` or server-only webhook secrets as `NEXT_PUBLIC_*` values.
`CRON_SECRET` must be identical on Web, Studio and Render: in addition to cron
authentication, it now proves that privileged `X-Kurasikapa-User` assertions
came from a trusted Next server rather than an internet client.

## Monthly operating budget

| Service | Mid/month | High/month | Assumption |
|---|---:|---:|---|
| Vercel | $20 | $150 | One Pro developer seat can own both projects; high adds another developer seat, traffic and observability allowance |
| Render API | $171 | $609 | Pro workspace plus one 1 CPU/2 GB service vs two 2 CPU/4 GB services for availability, using 730 hours/month |
| MongoDB Atlas | $58 | $394 | M10 vs M30, before backup/network overage |
| Cloudinary | $99 | $249 | Plus vs Advanced media plan |
| Resend | $20 | $90 | Pro 50k vs Scale 100k transactional emails |
| Anthropic | $50 | $300 | Editorial-assistance spending cap; usage based |
| Voyage embeddings | $5 | $40 | Multilingual semantic indexing and reader queries; usage based with a conservative launch allowance |
| OvenMediaEngine origin + standby | $125 | $320 | Self-hosted origin, durable recording storage, monitoring and optional standby before CDN traffic |
| Bunny CDN live delivery | $25 | $1,080 | Usage-driven; roughly 417 GB vs 18 TB at the published Africa rate of $0.06/GB |
| AWS narration + optional IVS fallback | $10 | $250 | Polly/S3 narration plus contingency for an exceptional managed broadcast |
| Domain and DNS | $2 | $10 | Annual domain renewal amortised monthly; DNS hosting can remain free |
| Monitoring and incident alerts | $23 | $140 | Launch logging/uptime allowance vs expanded retention, alerting and paging |
| OAuth, Turnstile, GA4, Search Console | $0 | $0 | Standard launch usage; provider limits and terms still apply |
| GitHub Actions and SonarCloud | $0 | $0 | Existing CI allowance and optional free analysis; paid team/analysis plans are outside this estimate |
| Contingency | $140 | $726 | About 20% for bandwidth, backups, tax and usage variance |
| **Estimated total** | **$748/month** | **$4,358/month** | Planning envelope; excludes salaries, production gear, legal work and payment fees |

These figures were rechecked against official price pages on 1 September 2026.
Render's current Pro workspace is $25/month and compute is additional: the
1 CPU/2 GB plan is $0.20/hour, while 2 CPU/4 GB is $0.40/hour per instance.
The Render line therefore includes both the workspace and continuously running
compute; bandwidth and tax remain part of contingency.
The high Atlas figure uses the published M30 base rate of $0.54/hour (about
$394 over a 730-hour month). The mid figure uses M10 at $0.08/hour (about $58).
Live cost is driven mainly by CDN bytes. At 2 Mbps, 100 viewers watching for two
hours transfer about 180 GB; at Bunny's published $0.06/GB Africa rate that is
about $10.80. One thousand viewers is about 1.8 TB or $108. These are planning
calculations, not quotes, and exclude origin egress, tax and cache misses.
Polly narration is billed per synthesized character and S3 holds only temporary
private output before Cloudinary promotion; set a lifecycle rule even though a
successful promotion deletes its staging object immediately.
Voyage currently includes the first 200 million `voyage-4` tokens per account;
the planning allowance covers later usage at $0.06 per million tokens and
provider-policy changes rather than assuming the launch remains free forever.

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
- [OvenMediaEngine](https://github.com/OvenMediaLabs/OvenMediaEngine)
- [Bunny pricing](https://bunny.net/pricing/)
- [Amazon IVS pricing](https://aws.amazon.com/ivs/pricing/) — fallback only
- [Amazon Polly pricing](https://aws.amazon.com/polly/pricing/)
- [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Voyage AI pricing](https://docs.voyageai.com/docs/pricing)
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
- A real live encoder feed cannot provision without caption confirmation; on
  the public Live page its in-band track enables CC and stays synchronized with
  speech throughout the operator smoke test.
- Donation/payment webhooks are verified, idempotent and reconciled in live mode.
- Sitemap, news sitemap, robots, canonical URLs, OG image and structured data use
  the final public host; Search Console accepts both sitemaps.
- Backups, spend alerts, error alerts, least-privilege access, key rotation and a
  rollback owner are documented and tested.
- Real content and team profiles replace all launch/demo empty states before the
  URL is shared publicly.

## Verified deployment state — 1 September 2026

- Public Web deployment `dpl_AvvY1eaf9R4CMY6breZa2BcKEMED` is Ready and owns
  the latest grouped newsroom navigation release. A live 1440px Chromium smoke
  opened a desk dropdown and verified its icon, title and description cards.
  Source CI run `33495714417` is fully green across all four jobs.
- Public Web deployment `dpl_dW3znp27DaArWM14LzQcukADxb9X` is Ready and the
  stable Vercel alias serves `/og-image` as `200 image/png` without redirecting
  through a locale.
- Studio deployment `dpl_FwNQxDRZoAj1JQNFyu12kF7KEzUk`, sign-in and the public
  Team route return HTTP 200; the Render API
  `/healthz` endpoint reports healthy.
- A fresh unauthenticated check on 1 September returned HTTP 307 from the Web
  bare host (the expected locale redirect), HTTP 200 from Studio sign-in and
  HTTP 200 from the Render API health check. The Studio Vercel project has all
  12 core launch variables configured; optional provider variables remain
  intentionally absent until their accounts and approvals are supplied.
- The API's public newsroom-profile endpoint is deployed and returns HTTP 200.
  The empty profile list is expected until approved journalist identities and
  portraits are supplied and published from Studio.
- `kurasikapa.tv` is attached to the Web project but does not currently resolve
  in DNS. Do not use it in launch announcements until DNS and TLS checks pass.
- Vercel currently builds with Node 24.x while the repository requests Node
  26+. The build succeeds, but the Web and Studio project settings should move
  to Node 26 when Vercel offers it, or the repository engine should be aligned
  deliberately after full verification.
