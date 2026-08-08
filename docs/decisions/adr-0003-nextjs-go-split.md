# ADR-0003 — Next.js on Vercel + Go service on Render

**Status:** Accepted · 2026-08-08
**Deciders:** Client

## Context

The client chose a Next.js frontend with a separate Go service, deployed to Vercel and Render respectively.

The workload genuinely splits in two. Reader and editor requests are short, interactive and session-bound. Live streaming, transcoding, social fan-out, bulk AI translation, TTS and RSS ingest are long-running, retryable and scheduled. Serverless functions are a poor host for the second kind.

## Decision

Two hexagons with an explicit contract.

**`apps/web` (Vercel)** — public site, editorial CMS, auth, RBAC, interactive AI streaming, reads.
**`services/media-svc` (Render)** — Mux orchestration and webhooks, transcoding, social publishing queue, bulk AI jobs, embeddings, RSS ingest, cron, digests.

The boundary is drawn at *slow, scheduled, or streaming*. They communicate over HTTP behind `MediaJobPort`, with the contract defined in one OpenAPI document that generates a TypeScript client and Go server stubs.

They do **not** share a domain model. A cross-language shared model is a fiction that costs more than it saves.

## Consequences

**Good.** Background work survives redeploys and runs past any function timeout. Go handles concurrent stream and webhook traffic well. Each side scales and fails independently.

**Cost.** Two deploy targets, two languages, two CI paths, and a network hop where an in-process call would otherwise do. Some domain vocabulary is expressed twice, once per language.

**Mitigation.** The OpenAPI document is the single source of truth for the contract and drift fails CI. Both services share one Atlas cluster, so there is no data synchronisation problem — only a contract to keep honest.
