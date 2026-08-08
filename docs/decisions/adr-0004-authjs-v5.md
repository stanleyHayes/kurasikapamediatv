# ADR-0004 — Auth.js v5 for authentication, domain-owned authorisation

**Status:** Accepted · 2026-08-08
**Deciders:** Client

## Context

The questionnaire requires Google, Facebook, Apple and email sign-in, 11 distinct roles, role permissions, 2FA and audit logs.

Two halves of one problem, and they belong in different places. *Authentication* — proving who someone is — is undifferentiated vendor work. *Authorisation* — deciding whether an Editor may publish a Journalist's article in `in_review` — is the core of the editorial product.

## Decision

**Auth.js v5** (`next-auth@5.0.0-beta.32`) with `@auth/mongodb-adapter` for authentication only. All four providers, sessions and account linking.

**Authorisation stays in `packages/domain/identity`.** Roles, permissions and the entitlement rules for premium content are domain concepts with domain tests. Auth.js supplies a user identity; it never decides what that user may do.

2FA is implemented on top of Auth.js (TOTP), because the 11-role model is ours regardless.

## Consequences

**Good.** No per-MAU cost. Identity data stays in our Atlas cluster, in the EU — relevant under GDPR. The interesting logic is testable with no HTTP, no session and no vendor.

**Cost.** More to build than Clerk: 2FA enrolment, recovery codes, and the admin UI for role assignment are ours.

**Risk accepted.** v5 is still tagged beta at `5.0.0-beta.32`. It is the version the Next.js App Router ecosystem has standardised on and it has been production-used for a long time, but the tag is a real risk. It is contained: authentication is reached through the composition root, so replacing it is one adapter and one wiring file, not a rewrite. If v5 has not shipped stable by R2, we re-evaluate against Better Auth.

**Rejected alternative.** Clerk. Faster to 2FA and org roles, but puts identity outside the hexagon, adds per-MAU cost on a growth-stage media business, and moves reader PII outside our own EU cluster.
