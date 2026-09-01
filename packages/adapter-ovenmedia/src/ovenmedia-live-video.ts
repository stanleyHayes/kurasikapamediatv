import { createHmac } from 'node:crypto'
import {
  LiveVideoUnavailable,
  type LiveVideoPort,
  type ProvisionChannelInput,
  type ProvisionedChannel,
} from '@kurasikapa/application'

export interface OvenMediaConfig {
  readonly apiUrl: string | undefined
  readonly apiToken: string | undefined
  readonly ingestUrl: string | undefined
  readonly playbackUrl: string | undefined
  readonly signingSecret: string | undefined
  readonly keyLifetimeSeconds: number
  readonly maxBroadcastSeconds: number
  readonly now: () => Date
  readonly nextId: () => string
  readonly fetcher?: typeof fetch
}

/** Self-hosted RTMP ingest, LL-HLS delivery and recording through OME. */
export class OvenMediaLiveVideo implements LiveVideoPort {
  constructor(private readonly config: OvenMediaConfig) {}

  async provision(_input: ProvisionChannelInput): Promise<ProvisionedChannel> {
    const configured = this.configured()
    const streamId = safeId(this.config.nextId())
    const recordingId = safeId(this.config.nextId())
    await this.request(':startRecord', {
      id: recordingId,
      stream: { name: streamId, variantNames: [] },
    }, configured)

    return {
      channelArn: `${streamId}:${recordingId}`,
      ingestEndpoint: configured.ingestUrl,
      streamKey: this.signedStreamKey(streamId, configured),
      playbackUrl: `${configured.playbackUrl}/${streamId}/master.m3u8`,
    }
  }

  async teardown(handle: string): Promise<void> {
    const configured = this.configured()
    const [streamId = '', recordingId = ''] = handle.split(':')
    if (streamId === '' || recordingId === '') throw new Error('Invalid OvenMediaEngine channel handle')

    await this.request(':stopRecord', { id: recordingId }, configured, true)
    await this.removeStream(streamId, configured)
  }

  private signedStreamKey(streamId: string, configured: RequiredConfig): string {
    const now = Math.floor(this.config.now().getTime() / 1000)
    const policy = Buffer.from(JSON.stringify({
      stream_expire: now + this.config.maxBroadcastSeconds,
      url_expire: now + this.config.keyLifetimeSeconds,
    })).toString('base64url')
    const unsigned = `${configured.ingestUrl}/${streamId}?policy=${policy}`
    const signature = createHmac('sha1', configured.signingSecret).update(unsigned).digest('base64url')
    return `${streamId}?policy=${policy}&signature=${signature}`
  }

  private async request(action: string, body: object, configured: RequiredConfig, missingIsOk = false): Promise<void> {
    const response = await (this.config.fetcher ?? fetch)(`${configured.apiUrl}/v1/vhosts/default/apps/app${action}`, {
      method: 'POST', headers: headers(configured.apiToken), body: JSON.stringify(body),
    })
    if (missingIsOk && response.status === 404) return
    if (!response.ok) throw new Error(`OvenMediaEngine could not ${action === ':startRecord' ? 'reserve the recording' : 'stop the recording'} (${String(response.status)})`)
  }

  private async removeStream(streamId: string, configured: RequiredConfig): Promise<void> {
    const response = await (this.config.fetcher ?? fetch)(
      `${configured.apiUrl}/v1/vhosts/default/apps/app/streams/${encodeURIComponent(streamId)}`,
      { method: 'DELETE', headers: headers(configured.apiToken) },
    )
    if (!response.ok && response.status !== 404) throw new Error(`OvenMediaEngine could not end the stream (${String(response.status)})`)
  }

  private configured(): RequiredConfig {
    return {
      apiUrl: clean(required(this.config.apiUrl, 'OVENMEDIA_API_URL')),
      apiToken: required(this.config.apiToken, 'OVENMEDIA_API_TOKEN'),
      ingestUrl: ingestUrl(required(this.config.ingestUrl, 'OVENMEDIA_INGEST_URL')),
      playbackUrl: clean(required(this.config.playbackUrl, 'OVENMEDIA_PLAYBACK_URL')),
      signingSecret: required(this.config.signingSecret, 'OVENMEDIA_SIGNING_SECRET'),
    }
  }
}

interface RequiredConfig { readonly apiUrl: string; readonly apiToken: string; readonly ingestUrl: string; readonly playbackUrl: string; readonly signingSecret: string }

function required(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new LiveVideoUnavailable(`Live video is not configured: ${name} is unset`)
  return value
}

function clean(value: string): string { return value.replace(/\/+$/u, '') }
function safeId(value: string): string { return value.toLowerCase().replace(/[^a-z0-9-]/gu, '').slice(0, 64) }
function headers(token: string): Record<string, string> { return { Authorization: `Basic ${Buffer.from(token).toString('base64')}`, 'Content-Type': 'application/json' } }

function ingestUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'rtmp:' || url.port === '') {
    throw new LiveVideoUnavailable('Live video is not configured: OVENMEDIA_INGEST_URL needs rtmp and an explicit port')
  }
  return clean(value)
}
