import type { IvsChannels } from './ivs-channels'
import { IvsLiveVideo, unconfigured } from './ivs-live-video'

/**
 * What the composition root wires when AWS is absent — the same posture as
 * `failClosedSocial` and `failClosedEmail`, for the same reason.
 *
 * It is the adapter itself with no credentials, not a second implementation, so
 * a deployment that forgot the keys refuses with exactly the message a
 * misconfigured production deployment produces. Nobody has to reconcile two
 * wordings, and there is no code path here that only runs when unconfigured.
 *
 * The seam refuses as well. That is deliberate belt-and-braces: if the
 * credential guard above it were ever loosened, this is what still stops an
 * unconfigured deployment from reaching AWS with whatever ambient role the
 * machine is carrying.
 */
export function failClosedIvs(): IvsLiveVideo {
  return new IvsLiveVideo({
    accessKeyId: undefined,
    secretAccessKey: undefined,
    channels: refusingChannels(),
  })
}

function refusingChannels(): IvsChannels {
  const refuse = (): Promise<never> => Promise.reject(unconfigured('AWS_ACCESS_KEY_ID'))

  return { createChannel: refuse, deleteChannel: refuse }
}
