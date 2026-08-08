# ADR-0006 — Mux for live TV and video

**Status:** Accepted · 2026-08-08
**Deciders:** Client

## Context

Kurasikapa is a television brand. Live TV, video gallery and podcast hosting are all ticked, and the design set already includes a Live TV gallery screen. Running this on an embedded YouTube player would mean the station does not own its player, its advertising inventory, or its viewer data — on the one surface where a TV brand most needs all three.

## Decision

**Mux** (`@mux/mux-node@14.1.1`) behind `StreamPort`, orchestrated by `services/media-svc`:

- Live streams: Mux Live, RTMP ingest, HLS playback, automatic recording to VOD.
- VOD: Mux Video for uploads, transcoding, thumbnails and captions.
- Podcasts: audio assets in object storage; Mux only where video podcasts need it.
- Playback analytics feed the `insight` context.

Mux webhooks terminate at `media-svc`, never at Vercel — they are long-lived, retried, and out-of-band.

## Consequences

**Good.** Live, VOD, transcoding, thumbnails and analytics arrive as one API. The Go service stays a thin orchestrator with no ffmpeg pipeline to operate.

**Cost.** Usage-priced on encoding, storage and delivery. This is the single largest running cost on the platform and it scales with viewership rather than with revenue. Budget it explicitly per release, and instrument delivery minutes from day one of R3.

**Deferred, deliberately.** Streaming lands in R3, not R1. `StreamPort` exists from R1 with an in-memory fake, so the CMS and Live TV screens can be built and tested before a single billable minute is spent.

**Escape hatch.** If cost becomes prohibitive at scale, the self-hosted path (ffmpeg → HLS → CDN) is a second adapter behind the same port. Deciding that now, with no viewership data, would be guessing.
