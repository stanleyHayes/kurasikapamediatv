# Live broadcast operator runbook

## What is live

Studio provisions one Amazon IVS low-latency channel per broadcast. The public
`/{locale}/live` page reads the current broadcast from MongoDB and plays its HLS
manifest with native Safari HLS or `hls.js` elsewhere. Ending a broadcast first
deletes the IVS channel so it stops billing, then marks the broadcast ended.

Readers poll a lightweight `/api/live-status/{locale}` projection every 15
seconds. Its response is shared at the CDN for 10 seconds with 20 seconds of
stale-while-revalidate, so audience size does not become one Mongo query per
viewer. Status freshness is bounded to roughly 30 seconds during revalidation.
Launch languages are the routing contract: English and French.

Recordings, VOD publishing, call-in stages and chat are not part of this slice.
Do not promise that ending a broadcast creates a replay.

## Before the first broadcast

1. Request an IVS concurrent-viewer quota of 50,000 in the selected AWS region.
2. Create a least-privilege IAM principal with IVS channel and stream-key create
   plus channel delete permissions. Set `AWS_REGION`, `AWS_ACCESS_KEY_ID` and
   `AWS_SECRET_ACCESS_KEY` on the Studio deployment only; the public site only
   reads MongoDB and must not receive ingest privileges.
3. No manual index bootstrap is required for broadcasts: the Mongo broadcast
   repository awaits its partial unique and history indexes before every first
   runtime operation. Deployment index bootstrap remains useful for the other
   collections, but Go Live does not race it.
4. In OBS, set output to 720p as the operating default and use a keyframe
   interval of two seconds. Keep 1080p in the rendition ladder when available.

## Going on air

1. Open Studio → Go live, select English or French and enter the title.
2. Provision the channel. Copy the Server and Stream key immediately; the key
   is deliberately never persisted and cannot be recovered from Studio.
3. In OBS choose Custom streaming service, paste both values, and start stream.
4. Open the public Live page in a separate connection and verify picture and
   sound. IVS can take several seconds to publish the first segments.

## Ending and incidents

End the broadcast in Studio even if OBS has already stopped. This deletes the
billable IVS channel. If deletion reports an error, the database deliberately
remains live: the public status and control room retain the incident, and a new
broadcast stays blocked. Use **Retry channel cleanup**. Teardown happens before
the ended state is persisted; a save failure is also safe to retry because IVS
treats an already-deleted channel as success. If retry still fails, delete the
channel in AWS using the ARN shown in the broadcast record, then retry Studio
once more so Mongo records the ended state.

If credentials are lost, end the broadcast and provision a new one. Never put a
stream key in chat, tickets, logs or screenshots. If a key leaks, delete its IVS
channel immediately. Check AWS billing alarms and the IVS console after every
incident.

If provisioning creates an IVS channel but Mongo cannot record it and automatic
compensation also fails, Studio shows **AWS cleanup required** with the channel
ARN. Copy that non-secret ARN, delete the matching channel in AWS immediately,
and retain the structured `live.cleanup_required` server log for the incident.
That log contains the ARN and failures, never the one-time stream key.
