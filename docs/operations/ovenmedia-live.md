# Self-hosted live origin runbook

This activates [ADR-0017](../decisions/adr-0017-ovenmediaengine-live-origin.md).
The checked-in Compose stack does not create a server, DNS record or Bunny
account.

## 1. Provision the origin

Start with a Linux host near Western Europe with:

- 8 modern CPU cores and 16 GB RAM for three software-encoded renditions;
- at least 200 GB of fast SSD recording space;
- Docker Engine with Compose;
- outbound traffic sized for CDN origin misses;
- inbound TCP 80, 443 and 1935. Keep 8081 closed publicly.

Point `live-origin.<domain>` directly to the host. Do not proxy RTMP through an
HTTP CDN.

## 2. Configure secrets

Copy `deploy/ovenmedia/.env.example` to `.env` on the host. Generate separate
random values of at least 32 bytes for `OVENMEDIA_API_TOKEN` and
`OVENMEDIA_SIGNING_SECRET`. Do not reuse an application secret.

`OME_HOST_IP` is the host's public address. `LIVE_ORIGIN_DOMAIN` is its DNS
name. Caddy obtains and renews the certificate.

## 3. Start and verify

From `deploy/ovenmedia` on the host:

```sh
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 ovenmedia
```

The logs must contain `All modules are initialized successfully`, RTMP listening
on `*:1935`, and the `app` application. A restart loop is a failed deployment.
Verify the authenticated API from the private network or an SSH tunnel only.

## 4. Configure Bunny CDN

Create a Standard Pull Zone with `https://live-origin.<domain>` as its origin.
Attach `live.<domain>`, enable TLS, disable caching for `.m3u8`, use short live
segment caching, enable a nearby origin shield and configure spend alerts.

Set `OVENMEDIA_PLAYBACK_URL=https://live.<domain>/app` on Studio. Public URLs
then have the form `https://live.<domain>/app/<stream>/master.m3u8`.

## 5. Configure Studio

Set these on Studio only:

```dotenv
LIVE_VIDEO_PROVIDER=ovenmedia
OVENMEDIA_API_URL=http://<private-origin-address>:8081
OVENMEDIA_API_TOKEN=<same raw API token>
OVENMEDIA_INGEST_URL=rtmp://live-origin.<domain>:1935/app
OVENMEDIA_PLAYBACK_URL=https://live.<domain>/app
OVENMEDIA_SIGNING_SECRET=<same signing secret>
OVENMEDIA_KEY_LIFETIME_SECONDS=900
OVENMEDIA_MAX_BROADCAST_SECONDS=14400
```

Vercel cannot normally reach a private address. Before activation, expose the
API through a mutually authenticated tunnel or move live provisioning into the
Go API's private network. Do not solve this by opening port 8081 publicly.

## 6. Broadcast acceptance

1. Use H.264, AAC, 30 fps and a two-second keyframe interval in OBS.
2. Confirm synchronized in-band captions before Go Live.
3. Copy the one-time server and stream key from Studio.
4. Verify all three variants on desktop and a constrained phone.
5. Confirm the delivered manifest contains the real synchronized caption track.
6. End the broadcast and verify MP4 and XML files on the recording volume.
7. Promote the recording to Cloudinary and attach reviewed WebVTT before replay.

## 7. Rollback

Set `LIVE_VIDEO_PROVIDER=disabled` to refuse new broadcasts. For an exceptional
managed broadcast, configure IVS and select `ivs`; workflows stay unchanged.

Back up recordings before host replacement. `docker compose down --volumes`
deletes the recording volume and must never be used on a production origin.
