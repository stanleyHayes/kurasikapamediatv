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
- **Every low-latency channel must use an IVS recording configuration.** IVS
  writes completed broadcasts to a private S3 destination. Missing
  `AWS_IVS_RECORDING_CONFIGURATION_ARN` refuses channel creation rather than
  allowing an unrecorded programme to disappear when the channel ends.
- **Every new live channel must carry synchronized in-band captions.** Studio
  requires the transmission operator to confirm the encoder caption source
  before provisioning. The public player discovers caption/subtitle tracks from
  the delivered HLS stream and exposes a CC toggle; stored legacy transmissions
  remain `unverified` until replaced by a newly provisioned accessible signal.
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
- Recording is a two-gate workflow: IVS capture protects the source; a video
  editor separately verifies the Cloudinary asset and synchronized WebVTT file
  before Go can place it on the public replay shelf. Capture is never treated
  as editorial publication.
- Foreign HLS manifests are not treated as Cloudinary delivery assets.
  EventBridge starts a MediaConvert MP4 job from IVS metadata, then Cloudinary
  ingests that result from an allowlisted private processing bucket. Only the
  temporary MP4 is deleted immediately; source HLS keeps a recovery lifecycle.
- GDPR: the company is France-registered. Chat messages are personal data and
  IVS Chat logging must target an EU region with a stated retention period.
  Audit and insight collections are already append-only (product rule 4); chat
  is **not** covered by that rule and must be deletable on request.

## Settled with the client, 2026-08-09

**720p is the default rendition.** 1080p stays in the ladder for viewers whose
connection supports it, but the default the player selects is 720p. This roughly
halves delivery cost against a 1080p default and is materially kinder to West
African data budgets, where mobile data is a real household expense. Cost and
audience pull the same way here, which is rare and worth taking.

**Chat messages are retained for 30 days.** Long enough for moderation to act
on a report and for an editor to review a complaint; short enough to defend
under GDPR's storage-limitation principle for a France-registered controller.

Moderation *actions* — bans, deletions, the fact that a decision was taken —
persist beyond 30 days as enforcement records. That is a different lawful basis
from the message content, and conflating the two would either destroy the ban
list every month or keep everyone's chat forever. Neither is acceptable.

Note this does **not** fall under product rule 4 (audit and insight collections
are append-only). Chat is personal data and must be deletable on request; an
append-only chat log would put us in direct conflict with a subject access
deletion.

**Audience ceiling: plan for 25,000 concurrent, provisioned to 50,000.**

This is an estimate, not a client figure — recorded as such so nobody later
mistakes it for one. The reasoning: a launching regional broadcaster serving
Ghana plus a European diaspora realistically peaks in the hundreds to low
thousands day to day, and the spikes that matter are elections, national team
matches and major breaking news. 25,000 leaves room for a spike an order of
magnitude above routine traffic.

The operational consequence matters more than the number. **IVS defaults to
15,000 concurrent viewers per region**, and raising it is a support ticket
measured in days with no priority lane. The quota increase to 50,000 must be
requested *before* a scheduled event, not during one. Revisit after the first
real broadcast, when there is traffic data instead of an estimate.
