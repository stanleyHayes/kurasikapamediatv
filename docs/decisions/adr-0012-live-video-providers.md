# ADR-0012 — Live video is a port with swappable providers; WebRTC is ours

- **Status:** Accepted, 2026-08-14
- **Refines:** [ADR-0010](adr-0010-media-stack.md), which named Amazon IVS as *the*
  live provider. IVS stays, but it stops being the only one.

## Context

R3 puts the station on its own air. ADR-0010 chose Amazon IVS, and the first
implementation followed it: `LiveVideoPort` provisions an IVS channel and hands
back an RTMPS ingest endpoint, a stream key and an HLS playback URL.

Two things changed that.

**There is no AWS account yet.** IVS also needs a quota request before it will
serve a single viewer. A feature that cannot be switched on is not a feature,
and "blocked on someone else's credentials" has already stalled Meta publishing
and Resend on this project.

**Renting the air is a strategic choice, not a technical one.** The exit
criterion for R3 is that Kurasikapa broadcasts on *its own property, not
someone else's platform*. Depending on a single hyperscaler for the thing the
station is named after is in tension with that, whatever the SLA says.

## Decision

**`LiveVideoPort` gains a provider registry, selected by configuration.**

```
LIVE_VIDEO_PROVIDER = webrtc | ivs | disabled      (default: disabled)
```

- `webrtc` — **ours.** Self-hosted, described below.
- `ivs` — Amazon IVS, unchanged. Kept, not deleted: it is the managed escape
  hatch for a national broadcast where somebody else's global CDN is worth
  paying for, and it is already written and tested.
- `disabled` — the default, and it **fails closed**. An unconfigured deployment
  refuses to start a broadcast with a clear message rather than provisioning
  nothing and reporting success. Same posture as the Meta publisher and Resend.

The port is now genuinely provider-neutral. Two AWS-isms are gone: `channelArn`
became `channelId` (an opaque handle), and the shape says which protocol it
speaks rather than assuming RTMPS in and HLS out — because a WebRTC provider
speaks neither.

## What "our own WebRTC" honestly means

This is the part worth being exact about, because "build it from scratch" hides
a cliff.

**Signalling is the easy half and it is genuinely ours.** WHIP (ingest) and
WHEP (playback) are HTTP: POST an SDP offer, get an SDP answer. No proprietary
protocol, no vendor SDK in the browser, a few hundred lines we own outright.

**Media routing is the hard half.** Three topologies, and only one of them is a
television station:

| | Servers | Broadcaster uplink | Ceiling |
|---|---|---|---|
| P2P mesh | none (beyond signalling) | 2 Mbps × every viewer | ~5–10 viewers |
| **SFU** | one, ours | 2 Mbps, once | thousands per node |
| MCU | one, expensive | 2 Mbps, once | CPU-bound, transcodes |

P2P is not a smaller version of broadcasting — it is a different thing that
stops working at the point an audience arrives. A phone uplink cannot serve
fifty viewers, and no amount of tuning changes that arithmetic.

So the WebRTC provider is an **SFU**, and it is built on **Pion**, the Go WebRTC
stack — in `services/media`, beside the Go API that already exists. "From
scratch" here means *we own and deploy the media server*, not that we implement
RTP, RTCP, jitter buffering, NACK/PLI and congestion control by hand. Those are
years of specialist work, they are already correct in Pion, and rewriting them
badly is how a broadcast stutters for reasons nobody can diagnose at 8pm.

### The cost nobody mentions until it breaks: TURN

Between 10% and 20% of viewers sit behind symmetric NAT and **cannot** be
reached peer-to-peer or by a bare SFU. They need a TURN relay, which is real
infrastructure: `coturn` is free software running on a box with bandwidth.

This is not optional and it is not an edge case — it is one viewer in six.
Without it, live video works perfectly in testing, on the office network, and
then fails for a fifth of the actual audience. `TURN_URL` / `TURN_USERNAME` /
`TURN_CREDENTIAL` are therefore first-class configuration, and the WebRTC
provider reports its absence as a degraded state rather than pretending.

## Consequences

**Good.** No AWS account needed to develop, demo or launch. The station owns
its transmission path. IVS remains one config value away for the broadcast that
warrants a global CDN. A third provider — Mux, Cloudflare Stream — is an
adapter, not a migration.

**Costs.**

- An SFU is a stateful, long-lived process. It does not fit the serverless model
  the rest of this system uses, so it is a separate deployment with separate
  operational concerns: scaling is by node, and a node that dies takes its
  broadcasts with it.
- Scale is now our problem. IVS absorbs a traffic spike; our SFU has a node
  count. R3's exit criterion does not require surviving a national event, but
  the first time one happens this is where it hurts.
- Two providers is two code paths, and the one that is not configured is the one
  that rots. `LIVE_VIDEO_PROVIDER` is exercised in tests for every provider so
  the unused path stays compiled and covered.

## Alternatives rejected

**IVS only, wait for the AWS account.** Simplest, and it is what ADR-0010 said.
It leaves R3 blocked on a credential nobody has, and concedes the transmission
path permanently.

**P2P WebRTC, no media server.** Genuinely zero infrastructure, and it demos
beautifully. It stops working at the tenth viewer, which is the moment it would
first matter. Shipping it would be shipping a demo as a feature.

**LiveKit / Janus / mediasoup as the SFU.** All good, all better tested than
anything written here. Rejected for the same reason Pion was chosen over
writing RTP by hand is *accepted*: this repository's pnpm policy denies install
scripts by default and blocks exotic sub-dependencies, mediasoup ships a C++
build, and LiveKit is a service to operate whichever way it is deployed. Pion is
a Go library that compiles into the binary we already build. Revisit if the SFU
becomes the thing that keeps someone awake.
