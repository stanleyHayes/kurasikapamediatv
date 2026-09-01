# ADR-0015 — manual semantic embeddings

**Status:** accepted  
**Date:** 2026-09-01

## Decision

Use Voyage `voyage-4` at 1,024 dimensions through a Go `EmbeddingPort`, store
approved article vectors in `article_semantic_documents`, and query them with
MongoDB Atlas Vector Search. Use Voyage's `document` input type for indexed
copy and `query` for reader searches.

Indexing is asynchronous. Publishing queues the approved revision, while the
protected Studio schedule retries pending work. Search and related-story reads
fall back to existing lexical and same-section paths when Voyage or the Atlas
index is unavailable.

## Why

The model is multilingual, supports the required EN/FR corpus and preserves a
stable 1,024-dimensional contract. Manual embeddings are selected because
Atlas automated embeddings are still documented as preview and unsuitable for
production. Keeping vectors outside the article aggregate also prevents retry
metadata and provider versioning from contaminating editorial state.

Every vector hit is reloaded from the source article repository and checked
for published status and locale before it crosses the public boundary. This is
the security boundary for delayed deactivation and stale-index failures.

## Atlas index

Create `article_semantic_vector` on `article_semantic_documents`:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
    { "type": "filter", "path": "locale" },
    { "type": "filter", "path": "active" }
  ]
}
```

The index must report `READY` before `VOYAGE_API_KEY` is enabled on Render.
Changing the model or dimensions requires a new index name and a full reindex;
an in-place mismatch is rejected rather than silently mixing vector spaces.
