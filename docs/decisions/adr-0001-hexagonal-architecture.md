# ADR-0001 — Hexagonal architecture

**Status:** Accepted · 2026-08-08
**Deciders:** Engineering Lead, Client

## Context

The signed questionnaire commits to ~200 features across five releases and 9–14 months, spanning publishing, AI, streaming, social distribution, payments and analytics. Several vendor choices in that list are ones we should expect to change: the AI provider, the payment provider (two already, by region), the streaming provider, and possibly the CMS editor itself.

A conventional Next.js layout — business rules inside route handlers and Server Actions — makes each of those swaps a rewrite, and makes the editorial workflow (the most valuable logic in the product) untestable without a database and a running framework.

## Decision

Ports & Adapters. Four rings:

1. `packages/domain` — entities, value objects, invariants. Zero runtime dependencies.
2. `packages/application` — use cases and port interfaces. Imports domain only.
3. `packages/adapter-*` — one package per external technology, each implementing ports.
4. `apps/web` and `services/media-svc` — driving adapters and composition roots.

Enforced by `dependency-cruiser` in CI, not by convention.

## Consequences

**Good.** The editorial workflow is tested in milliseconds with no infrastructure. Swapping Anthropic for another provider, or Stripe for Paystack, touches one package. New engineers have one rule to learn: dependencies point inward.

**Cost.** More packages and more indirection than a single Next.js app. A trivial CRUD feature costs an interface it would not otherwise need. We accept this — the scope is not trivial and the vendor churn is not hypothetical.

**Rejected alternative.** Feature-sliced Next.js with colocated logic. Faster for the first six weeks, then the AI provider changes and the cost arrives all at once.
