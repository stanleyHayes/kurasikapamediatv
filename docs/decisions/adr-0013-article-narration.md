# ADR-0013 — Article narration is asynchronous and editor-approved

- **Status:** Accepted, 2026-08-31
- **Refines:** [ADR-0010](adr-0010-media-stack.md)

## Context

Long newsroom articles exceed synchronous text-to-speech request limits, audio
generation can fail after a request has returned, and AI output must not be
published without editorial approval. English and French also have supported
AWS Polly generative voices, while Twi does not.

## Decision

The Go API owns a persisted narration-job lifecycle. A publishing editor starts
a job against the exact approved revision. AWS Polly performs asynchronous
generative synthesis into a private, same-region S3 bucket. On completion the
adapter streams the MP3 into Cloudinary, creates a provider-neutral ready audio
asset, and deletes the staging object. Studio presents a private review player;
only a second explicit editor action attaches the narration to the article.

The public article exposes the attached immutable snapshot, identifies it as a
synthetic voice and links to the article body as its transcript. English uses
Amy and French uses Florian. Twi fails closed until a newsroom-reviewed provider
and voice are selected.

## Consequences

- Failed or abandoned jobs never alter the public story.
- Editing or approving a different revision invalidates stale narration.
- S3 is temporary private storage; Cloudinary remains the public media CDN.
- The API needs a least-privilege Polly/S3 IAM principal and lifecycle policy.
- The cron processor is idempotent and can safely poll every five minutes.
