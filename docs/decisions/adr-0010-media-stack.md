# ADR-0010 — Media stack: Amazon IVS for live, Cloudinary for assets, Resend for email

- **Status:** Accepted, 2026-08-09
- **Supersedes:** [ADR-0006](adr-0006-mux-streaming.md) — Mux is not adopted.

## Context

ADR-0006 chose Mux for live TV, VOD, transcoding and podcasts. It was chosen
before any of it was built, on the strength of developer experience, and it was
never revisited against the actual requirement: the client wants **live video
interaction**, not just live video.

The client subsequently named their stack — MongoDB, Go, Next.js, Cloudinary,
Resend — and asked us to evaluate "the Amazon one" for live interaction. That
is Amazon Interactive Video Service (IVS).

## What the evaluation found

Researched August 2026 against vendor documentation and pricing.

| | Amazon IVS | Mux | Cloudinary |
|---|---|---|---|
| Broadcast latency | < 5 s | 4–7 s (LL-HLS) | HLS, not latency-optimised |
| Real-time interaction | **< 300 ms, ≤ 12 publishers** | none | none |
| Chat + moderation | **built in** | none | none |
| Official Go SDK | **`ivs`, `ivschat` in AWS SDK v2** | limited | yes |
| West Africa edge | CloudFront **Lagos PoP** | multi-CDN | multi-CDN |

The deciding factor is the second and third rows. IVS Real-Time ("stages")
puts a host and up to eleven guests in sub-300 ms conversation, composites the
result server-side, and broadcasts it to an unlimited audience through a
low-latency channel. IVS Chat carries the audience side with moderation hooks
and message-review handlers. Neither Mux nor Cloudinary offers either; both
would mean assembling live video, a WebRTC provider and a chat provider into
something we then own the seams of.

## Decision

- **Live TV and live interaction → Amazon IVS.** Low-Latency channels for the
  broadcast; Real-Time stages for call-in guests; IVS Chat for the audience.
- **Images, VOD, podcasts, the whole media library → Cloudinary.** It is the
  client's stated choice, it is a genuinely strong asset pipeline, and live is
  not what it is for.
- **Email → Resend.** Transactional first, newsletter digests at R2.
- **Mux is not adopted.** ADR-0006 is superseded before any code was written
  against it, which is the cheapest possible moment to reverse it.

### Ports

Four ports, kept separate so each can be replaced alone. The split is not
ceremony: live broadcast, real-time interaction and chat have genuinely
different providers in the market, and collapsing them into one `StreamPort`
would mean a single interface no second vendor could ever satisfy.

```
StreamPort     start/stop a channel, ingest keys, playback URLs, recordings
StagePort      real-time rooms: join tokens, participants, composition
ChatPort       rooms, tokens, moderation, message events
MediaPort      Cloudinary: upload, transform, deliver, audio + transcripts
EmailPort      Resend: transactional now, bulk at R2
```

## Consequences

- **Cost is dominated by viewer-hours × bitrate, and is provider-independent
  within roughly 2×.** At 2,000 concurrent viewers for 360 hours a month —
  720,000 viewer-hours — IVS 1080p output is on the order of $100k/month before
  volume tiering; Mux and Cloudflare Stream land in the same band. The lever
  that matters is defaulting to **720p**, not the vendor. West African
  bandwidth costs argue for that independently, so the two pressures agree.
- **The 15,000 concurrent-viewer default quota is an operational trap.**
  Raising it is a support ticket measured in days. Election night, a major
  match, a breaking story — the increase must be requested weeks ahead. This
  belongs in a runbook, not in someone's memory.
- **Twelve publishers is the hard ceiling on a stage.** Host plus panel, yes.
  Community broadcasting, no. If that requirement ever appears, it is a new
  ADR, not a configuration change.
- **AWS account setup is real work** — IAM, regions, billing alarms across IVS,
  CloudFront and S3. Budgeted as such rather than assumed away.
- Two vendors now hold media instead of one. Accepted deliberately: the
  alternative is one vendor that does neither job as well.
- GDPR: the company is France-registered. Chat messages are personal data and
  IVS Chat logging must target an EU region with a stated retention period.
  Audit and insight collections are already append-only (product rule 4); chat
  is **not** covered by that rule and must be deletable on request.

## Open for the client

- **Live TV audience ceiling.** Sizes the quota request and the bitrate ladder.
- **Is a 720p default acceptable** for the main broadcast? It roughly halves
  delivery cost against 1080p and is kinder to West African data budgets.
- **Chat retention period**, given GDPR and the moderation requirement.
