# ADR-0005 — AI SDK with Anthropic as the single provider

**Status:** Accepted · 2026-08-08
**Deciders:** Client

## Context

Sixteen AI features are ticked: draft from prompt, draft from bullets, rewrite, tone adjustment, headlines, SEO, meta description, tags, auto-category, summarise, translate, fact-check notes, image prompts, social captions, article-to-audio, voice-to-article.

## Decision

**Vercel AI SDK v5** (`ai@7.0.58`) with `@ai-sdk/anthropic@4.0.36` — Claude as the only text provider. One `AiPort`, one adapter, one key, one bill. This also matches the company Ops Manual, which already assigns Claude to planning and documentation work.

Two capabilities are not text and get their own ports in R3, decided then: text-to-speech (article-to-audio) and speech-to-text (voice-to-article).

## Consequences

**Good.** One vendor relationship. Provider-specific behaviour — prompt shape, token accounting, retries, refusals — is isolated in `adapter-anthropic`. Streaming is exposed to the application as `AsyncIterable<string>`, so no framework stream type leaks inward.

**Cost.** Every task pays Claude pricing, including cheap ones like auto-tagging that a smaller model would handle. This is a real running cost on a per-article basis.

**Migration path.** Because there is exactly one port, moving to Vercel AI Gateway later — to route tagging to a cheap model and rewriting to Claude — is a change inside `adapter-anthropic` plus a config value. No use case changes. We deliberately did not build that routing now; it is complexity without evidence.

**Product rule, not a technical one.** Every `AiPort` method returns a *proposal*. Nothing AI-generated is persisted or published without an editor accepting it. For a media house whose stated core values are integrity and excellence, auto-publishing generated text is an existential risk, not a feature.
