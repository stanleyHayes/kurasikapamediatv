# ADR-0014 — Voice-to-article stays local until editorial acceptance

- **Status:** Accepted, 2026-09-01
- **Refines:** [ADR-0005](adr-0005-ai-sdk-anthropic.md)

## Context

Voice-to-article must speed up field reporting without making unreviewed speech
recognition part of the editorial record. Batch transcription services persist
provider output before a journalist can review it, which conflicts with the
rule that AI output is a proposal and cannot be persisted automatically.

## Decision

Studio owns a `SpeechToTextPort` backed by the browser speech-recognition API.
An editor explicitly starts and stops English or French dictation. Final speech
segments are appended to the existing Markdown value in browser memory;
interim text is visible but never inserted. The journalist can rewrite every
word before the existing `CreateDraft` action persists the first revision.

Unsupported browsers fail closed and keep the normal rich Markdown editor fully
available. No microphone stream, provider transcript, or new credential enters
the Kurasikapa API. The interface copy discloses that recognition is handled by
the browser's speech service.

## Consequences

- Speech recognition can never publish or create an article by itself.
- The existing draft, review, approval and publication permissions remain the
  only path to production journalism.
- Chrome and Edge provide the primary production experience; unsupported
  browsers receive an explicit fallback instead of a broken control.
- Uploaded-recording transcription can be added later only if its provider and
  retention model preserve the same editor-before-persistence boundary.
