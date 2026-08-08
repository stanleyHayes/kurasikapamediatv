# ADR-0004 — Better Auth for authentication, domain-owned authorisation

**Status:** Accepted · 2026-08-08
**Supersedes:** the original 2026-08-08 decision in favour of Auth.js v5, reversed the same day on new evidence (see § Reversal).
**Deciders:** Client

## Context

The questionnaire requires Google, Facebook, Apple and email sign-in, 11 distinct roles, role permissions, 2FA and audit logs.

Two halves of one problem, and they belong in different places. *Authentication* — proving who someone is — is undifferentiated vendor work. *Authorisation* — deciding whether an Editor may publish a Journalist's article in `in_review` — is the core of the editorial product.

## Decision

**Better Auth 1.6.25** for authentication only, with its MongoDB adapter against our existing Atlas cluster.

**Authorisation stays in `packages/domain/identity`.** Roles, permissions and the entitlement rules for premium content are domain concepts with domain tests. Better Auth supplies a verified identity; it never decides what that identity may do.

Role assignments live in **our own collection**, not in the auth library's user document. The library owns `user`, `session`, `account` and `verification`; we own `role_assignments`. That keeps the vendor's schema out of our domain and makes a future migration a data copy rather than a redesign.

## Reversal — why not Auth.js v5

The original decision picked Auth.js v5 and recorded the risk: *"v5 is still tagged beta… If v5 has not shipped stable by R2, we re-evaluate against Better Auth."*

That re-evaluation arrived immediately, because installing it tripped our own supply-chain policy:

```text
ERR_PNPM_TRUST_DOWNGRADE  High-risk trust downgrade for "next-auth@5.0.0-beta.32"
```text

Querying the npm registry directly rather than trusting the error message:

| Package | Stable | Provenance attestation |
|---|---|---|
| `next-auth` — **every** version, v4 and all v5 betas | v5 is beta | **none, ever** — registry-signed but never attested |
| `@auth/mongodb-adapter@3.11.3` | yes | SLSA v1 |
| `better-auth@1.6.25` | **yes** | SLSA v1 |

Two independent signals pointed the same way: still beta after a long run, and no build provenance on any release. Auth is the single dependency where provenance matters most, because it sits on the credential path for every user on the platform.

**This is not a claim that next-auth is compromised.** Many projects publish betas from a pipeline without provenance. It is a missing signal, not a bad one — but on the credential path we prefer the library that has it.

## Consequences

**Good.** Stable rather than beta. Provenance attestation, so the package installs under our unmodified supply-chain policy — no exception to justify or forget. All four providers, plus first-class 2FA and email-OTP plugins, so less of the questionnaire is ours to build than under Auth.js. Identity data stays in our own EU cluster, which matters under GDPR.

**Cost.** Smaller community than Auth.js, so fewer answers exist when something breaks at 2am. Younger project, so a faster-moving API.

**Contained.** Authentication is reached only through the composition root, and authorisation was never the library's job. Replacing it is one config file, one bridge function, and no change to `packages/domain` or `packages/application`.

**Rule that survives this decision.** A UI role check is cosmetic and is never the control. Every mutating Server Action re-derives the `Actor` from the session and lets the domain decide.
