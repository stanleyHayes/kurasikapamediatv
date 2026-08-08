# ADR-0005 — AI SDK with Anthropic as the single provider

**Status:** Accepted · 2026-08-08
**Deciders:** Client

## Context

Sixteen AI features are ticked: draft from prompt, draft from bullets, rewrite, tone adjustment, headlines, SEO, meta description, tags, auto-category, summarise, translate, fact-check notes, image prompts, social captions, article-to-audio, voice-to-article.

## Decision

**Vercel AI SDK v5** (`ai@7.0.58`) with `@ai-sdk/anthropic@4.0.36` — Claude as the only text provider. One `AiPort`, one adapter, one key, one bill. This also matches the company Ops Manual, which already assigns Claude to planning and documentation work.

Two capabilities are not text and get their own ports in R3, decided then: text-to-speech (article-to-audio) and speech-to-text (voice-to-article).

### Embeddings are a separate port, and a separate provider

**Anthropic ships no embedding model.** This was found while building the adapter, not while planning it. `AiPort` therefore has no `embed()` method; `EmbeddingPort` is its own interface in `packages/application/src/ports/embedding.ts`, deliberately unimplemented.

That matters because two ticked features depend on it — AI semantic search and recommended articles, both via Atlas Vector Search. Both land in **R2**, so the provider decision (Voyage, OpenAI, Cohere, or Atlas-managed embeddings) is deferred to the R2 planning gate rather than guessed now. `EmbeddingPort.dimensions` is part of the contract because it must match `numDimensions` on the Atlas index — a mismatch degrades result quality silently rather than erroring.

### Model routing

One provider, three tiers, routed per task in `packages/adapter-anthropic/src/models.ts`:

| Tier | Model | Tasks |
|---|---|---|
| best | `claude-opus-5` | fact-checking — a miss here is a correction, not an annoyance |
| balanced | `claude-sonnet-5` | drafting, rewriting, headlines, translation — editors read every word |
| cheap | `claude-haiku-4-5` | SEO, tagging, category detection, summaries — mechanical work |

Per-task overrides are config, not code, so a tier can be re-pointed without a deploy. Auto-tagging every wire story on a frontier model is how AI quietly becomes the platform's largest line item.

**Naming trap:** the direct provider hyphenates versions (`claude-haiku-4-5`); AI Gateway uses a namespace and dots (`anthropic/claude-haiku-4.5`). We are on the direct provider, so hyphens are correct — `tsc` checks the ids against the provider's own union type. Linters tuned for Gateway slugs report a false positive here.

## Consequences

**Good.** One vendor relationship. Provider-specific behaviour — prompt shape, token accounting, retries, refusals — is isolated in `adapter-anthropic`. Streaming is exposed to the application as `AsyncIterable<string>`, so no framework stream type leaks inward.

**Cost.** Every task pays Claude pricing, including cheap ones like auto-tagging that a smaller model would handle. This is a real running cost on a per-article basis.

**Migration path.** Because there is exactly one port, moving to Vercel AI Gateway later — to route tagging to a cheap model and rewriting to Claude — is a change inside `adapter-anthropic` plus a config value. No use case changes. We deliberately did not build that routing now; it is complexity without evidence.

**Product rule, not a technical one.** Every `AiPort` method returns a *proposal*. Nothing AI-generated is persisted or published without an editor accepting it. For a media house whose stated core values are integrity and excellence, auto-publishing generated text is an existential risk, not a feature.
