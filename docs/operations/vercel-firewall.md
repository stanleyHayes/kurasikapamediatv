# Vercel firewall rollout

Kurasikapa uses two Vercel projects: public Web and authenticated Studio. This
runbook is the launch configuration and evidence gate for their project-level
firewalls. Apply rules in **Log** mode first, observe real traffic for at least
ten minutes, then promote individually. Never publish all blocking rules at
once; Vercel keeps firewall versions so each change can be rolled back.

## Plan boundary

Vercel custom rules, project IP blocking, bot protection, fixed-window rate
limiting and Attack Challenge Mode are available on current self-service plans.
The managed OWASP Core Ruleset is Enterprise-only. Do not claim OWASP managed
coverage on Hobby or Pro; the application security headers, input validation,
authorisation tests and independent pentest remain required.

## Public Web project

Create these rules in order. Preserve verified search/news crawlers and the
scheduled publisher calls.

1. **Bypass trusted automation.** Bypass bot/rate rules for exact protected cron
   and cache-revalidation paths only when their normal bearer authentication is
   present. Do not place the secret value in a firewall rule or screenshot.
2. **Deny common exploit probes.** Deny paths containing `/.env`, `/.git`,
   `/wp-admin`, `/wp-login.php`, `/phpmyadmin` or a null byte. Start in Log,
   verify no legitimate route matches, then Deny with a ten-minute persistent
   action.
3. **Rate-limit credential recovery.** Fixed window by IP for sign-in,
   registration, forgot-password and reset-password routes: begin at 20
   requests per minute with a `429` action. The application limiter remains the
   authoritative per-account control.
4. **Rate-limit write APIs.** Fixed window by IP for contact, comments,
   newsletter, engagement and push subscription endpoints: begin at 60 requests
   per minute with `429`. Exclude authenticated cron and webhook routes.
5. **Bot protection.** Run the managed Bot Protection ruleset in Log mode for a
   day, confirm Google/Bing and legitimate syndication clients are recognised,
   then use Challenge for browser-only write journeys. Do not challenge RSS,
   sitemaps, `/v1` or public article reads.

## Studio project

1. Deny the same exploit-probe paths.
2. Rate-limit `/studio/*` by IP at 120 requests per minute. Studio uses Server
   Actions and streamed refreshes, so a newsroom session legitimately produces
   more requests than a static reader page.
3. Rate-limit `/studio/api/ai/*` at 20 requests per minute by IP to bound AI
   spend; keep the application actor limiter enabled.
4. Apply Bot Protection in Log mode before Challenge. Explicitly test sign-in,
   MFA, password reset, invitations, article autosave and media upload from the
   newsroom's normal networks before promotion.

## Emergency mode

Attack Challenge Mode is an incident control, not the normal reader experience.
Enable it during a confirmed traffic attack, record the incident and start/end
times, monitor newsroom and search traffic, then disable it once the event is
contained. Do not leave it enabled as a substitute for tuned rules.

## Acceptance evidence

- Screenshot/export of each project rule list, order, mode and publication time.
- Ten-minute Log-mode traffic sample with false-positive review.
- HTTP evidence that blocked probes are denied, abusive bursts receive `429`,
  normal sign-in and publishing still work, and Google News/RSS/API reads pass.
- Named firewall owner and rollback owner.
- Current plan recorded; if Enterprise, OWASP CRS starts in Log and each enabled
  rule is promoted only after false-positive review.
- Independent Strix report attached when an LLM key or managed token is
  available. Dependency and reachable-code scans are supporting evidence, not
  a replacement for exploit validation.

## Current repository evidence

`pnpm audit --prod --audit-level high` reports no known production dependency
vulnerabilities. `govulncheck ./...` reports zero reachable Go vulnerabilities;
it separately reports imported/module advisories that are not called by this
service. CI also runs secret scanning, dependency audit, security-header tests,
real authorisation journeys and Lighthouse. Provider firewall publication and
the Strix exploit scan remain separate launch evidence.
