import { ResourceNotFoundException, type CreateChannelCommandOutput } from '@aws-sdk/client-ivs'
import {
  LiveVideoUnavailable,
  type LiveVideoPort,
  type ProvisionChannelInput,
  type ProvisionedChannel,
} from '@kurasikapa/application'
import type { IvsChannels } from './ivs-channels'

export interface IvsConfig {
  readonly accessKeyId: string | undefined
  readonly secretAccessKey: string | undefined
  readonly channels: IvsChannels
}

/**
 * Amazon IVS channel lifecycle — the only place that knows the station's air
 * is rented from AWS (ADR-0010).
 *
 * Fail-closed: unset credentials throw, so StartBroadcast records a visible
 * failure and the operator is told. The alternative is worse than an outage —
 * a channel that was never created, a playback URL on the front page pointing
 * at nothing, and a newsroom that finds out from the audience.
 *
 * The guard reads the credentials even though it is the SDK that signs the
 * requests, because "absent from the environment" is not what the SDK hears.
 * Its default provider chain keeps looking: the shared profile in `~/.aws`, an
 * EC2 instance role, a container role. An unconfigured deployment therefore
 * does not fail — it broadcasts from whatever account the machine happens to
 * carry, which on a developer's laptop is a personal one and in CI is nobody's,
 * and the channel bills to an account nobody is watching. Checking here is what
 * makes "unset" mean *refused*.
 */
export class IvsLiveVideo implements LiveVideoPort {
  constructor(private readonly config: IvsConfig) {}

  async provision(input: ProvisionChannelInput): Promise<ProvisionedChannel> {
    const channels = this.configured()

    const created = await channels.createChannel({
      name: input.name,
      // STANDARD transcodes to a rendition ladder, so a viewer on a phone in a
      // weak cell still sees the news; BASIC is cheaper and passes a single
      // rendition through, which makes the broadcast unwatchable for exactly
      // the audience least able to switch to something else.
      type: 'STANDARD',
      latencyMode: 'LOW',
      // Playback stays unauthorised: the HLS URL is public by design — it is
      // what the player on the front page loads. Ingest is not, and is gated by
      // the stream key alone. Entitlement, when it arrives, is a decision for
      // the domain, not a flag set once at provision time.
      authorized: false,
    })

    return provisioned(created)
  }

  async teardown(channelArn: string): Promise<void> {
    const channels = this.configured()

    try {
      await channels.deleteChannel({ arn: channelArn })
    } catch (error) {
      // Idempotent by contract. EndBroadcast persists the ended state *before*
      // calling this, so a retry after a dropped response asks to delete a
      // channel that is already gone — the success case arriving twice, not a
      // failure. Every other fault still throws: a channel that survives this
      // call keeps billing by the hour, and swallowing the error would discard
      // the only signal that it is still up.
      if (error instanceof ResourceNotFoundException) return
      throw error
    }
  }

  private configured(): IvsChannels {
    if (!present(this.config.accessKeyId)) throw unconfigured('AWS_ACCESS_KEY_ID')
    if (!present(this.config.secretAccessKey)) throw unconfigured('AWS_SECRET_ACCESS_KEY')

    return this.config.channels
  }
}

/**
 * One wording for every refusal, so an operator greps a single string.
 *
 * `LiveVideoUnavailable` rather than a bare `Error` because this is the
 * *expected* state of any deployment without AWS — ADR-0012 makes that the
 * default — and the studio's action plumbing rethrows what it does not
 * recognise. Typed, it reaches the Go-live form as the sentence below; untyped,
 * the operator gets a 500 and no idea which variable is missing.
 */
export function unconfigured(key: string): LiveVideoUnavailable {
  return new LiveVideoUnavailable(`Live video is not configured: ${key} is unset`)
}

function provisioned(response: CreateChannelCommandOutput): ProvisionedChannel {
  const channel = response.channel

  return {
    channelArn: required(channel?.arn, 'ARN'),
    ingestEndpoint: rtmpsUrl(required(channel?.ingestEndpoint, 'ingest endpoint')),
    streamKey: required(response.streamKey?.value, 'stream key'),
    playbackUrl: required(channel?.playbackUrl, 'playback URL'),
  }
}

/**
 * Every field on an IVS response is optional in the generated types, and a
 * half-filled channel must not reach the operator as a working one: without the
 * ARN nothing can ever tear it down and it bills until somebody finds it in the
 * console, and without the key there is nothing to broadcast with.
 *
 * The message names the missing field and never the value — one of these four
 * *is* the stream key, and an error string is precisely where it must not
 * appear. See `ProvisionedChannel` on why that key is written nowhere.
 */
function required(value: string | undefined, field: string): string {
  if (value === undefined || value === '') {
    throw new Error(`IVS returned a channel with no ${field}`)
  }

  return value
}

/**
 * IVS hands back a bare host — `a1b2c3d4e5f6.global-contribute.live-video.net`.
 * OBS and every other RTMPS encoder want a full URL with the `/app/` path, and
 * given the bare host they refuse to connect at the moment the operator is
 * trying to go on air, with a message that explains nothing. Build it once,
 * here, so the studio can show a value that can be pasted.
 *
 * The scheme check is not defensive noise: if AWS ever starts returning a
 * complete URL, prefixing it again produces a value that is silently wrong.
 */
function rtmpsUrl(host: string): string {
  return host.includes('://') ? host : `rtmps://${host}:443/app/`
}

function present(value: string | undefined): value is string {
  return value !== undefined && value !== ''
}
