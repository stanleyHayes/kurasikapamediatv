# ADR-0002 — MongoDB Atlas, not self-hosted MongoDB

**Status:** Accepted · 2026-08-08
**Deciders:** Client (database choice), Engineering Lead (Atlas requirement)

## Context

The client selected MongoDB. The questionnaire also ticks **AI Semantic Search**, **Recommended Articles**, **Related Articles** and **Global Search**.

Self-hosted MongoDB Community can serve documents but cannot serve those four features: full-text search and vector search are Atlas capabilities. Delivering them on Community means bolting on Elasticsearch plus a separate vector database — two more services, two more failure modes, and a dual-write consistency problem on every publish.

## Decision

**MongoDB Atlas**, using Atlas Search for lexical queries and Atlas Vector Search for semantic search and recommendations. Both indexes live on the `articles` collection alongside the data.

Driver pinned to `mongodb@6.21.0`.

## Consequences

**Good.** Four ticked features are satisfied by one datastore. No dual-write. Managed backups, PITR and EU region residency, which matters for a France-registered company under GDPR.

**Cost.** Vendor lock-in to Atlas specifically, and a per-cluster monthly cost. Contained by `SearchPort` and `VectorSearchPort` — the query syntax lives in `adapter-search` only.

**Constraint discovered.** `@auth/mongodb-adapter@3.11.3` peers `mongodb@^6`, so the current driver v7 is unusable. The driver is pinned to v6.21.0 project-wide. Revisit when the Auth.js adapter supports v7.

**Constraint.** Multi-document transactions (publish writes article + revision + audit log) require a replica set. Local development therefore runs a single-node replica set, not a standalone `mongod`.
