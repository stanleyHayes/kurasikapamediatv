# ADR-0017 — OvenMediaEngine is the owned live origin

- **Status:** Accepted, 2026-09-01
- **Supersedes:** ADR-0012's proposed custom Pion SFU
- **Retains:** Amazon IVS as an explicit fallback provider

## Context

The station needs RTMP ingest from OBS, adaptive playback, recording and a
route to scale distribution without paying a managed-live premium from day one.
Writing signalling is tractable; writing and operating a reliable transcoder,
HLS packager, recorder and media router is not the application's business.

The first IVS adapter already proved the application boundary: editorial rules
depend on `LiveVideoPort`, not AWS. That lets us change infrastructure without
changing permission, caption, lifecycle or public-visibility rules.

## Decision

`LIVE_VIDEO_PROVIDER=ovenmedia` is the production default.

- OvenMediaEngine v0.20.5 receives RTMP and produces a 720p/480p/360p LL-HLS
  ladder. The version is pinned in `deploy/ovenmedia/compose.yaml`.
- Native SignedPolicy creates a short-lived encoder URL and a maximum broadcast
  lifetime. Playback remains public and contains no ingest credential.
- A recording task is reserved before Studio receives encoder credentials.
  Provisioning fails closed if recording cannot be reserved.
- Caddy terminates TLS at the origin. Bunny CDN pulls the LL-HLS manifests and
  segments from that origin; the application stores the Bunny playback host.
- The OvenMediaEngine REST API stays on the private container network. Only the
  composition root holds its token.
- The existing IVS adapter and recording promotion remain compiled and tested.
  `LIVE_VIDEO_PROVIDER=ivs` is the managed fallback for exceptional broadcasts.
- `disabled` remains a fail-closed operational state.

The existing TypeScript composition seam provisions live channels today. The
Go API continues to own programme schedules, public guide data, replay rules and
recording promotion. Moving the lifecycle call across that existing BFF seam is
a later bounded-context migration; it is not coupled to adopting the media
origin.

## Security and accessibility

The stream name is public, while the RTMP query carries a time-limited HMAC-SHA1
SignedPolicy accepted by OvenMediaEngine. The signing secret and REST token are
separate values. Stream keys are returned once and never persisted.

The application continues to refuse Go Live until the operator confirms an
in-band synchronized caption source. A production acceptance test must still
verify the delivered manifest contains the caption track; configuration alone
does not prove accessibility.

## Consequences

We pay for predictable compute, storage and CDN traffic instead of IVS input and
viewer-hour pricing. We also own capacity planning, patching, monitoring,
recording retention and incident response. A single origin is acceptable for a
demo and soft launch, not a national event; high-availability launch requires a
standby origin and tested DNS/CDN failover.

OvenMediaEngine recordings land on a durable volume. Promotion to Cloudinary is
still required before a recording becomes a public replay, and the existing
WebVTT gate remains unchanged.

## Rejected alternatives

- **Custom Pion SFU:** does not solve RTMP, ABR transcoding, LL-HLS packaging or
  recording without creating a specialist media-server programme.
- **Owncast:** excellent for one creator stream, but its product model is less
  suitable for a scheduled station with provider-neutral control and multiple
  programme workflows.
- **Delete IVS:** removes a useful surge-capacity fallback for no operational
  benefit; provider selection already isolates it.
