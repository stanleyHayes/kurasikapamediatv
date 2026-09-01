import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { LiveVideoUnavailable } from '@kurasikapa/application'
import { OvenMediaLiveVideo, type OvenMediaConfig } from './ovenmedia-live-video'

const responseWith = (status: number): Promise<Response> => Promise.resolve(new Response(null, { status }))

const config = (fetcher: typeof fetch = vi.fn(() => responseWith(200))): OvenMediaConfig => ({
  apiUrl: 'http://ome.internal:8081',
  apiToken: 'api-token',
  ingestUrl: 'rtmp://live.kurasikapa.tv:1935/app',
  playbackUrl: 'https://live.kurasikapa.tv:3334/app',
  signingSecret: 'signing-secret',
  keyLifetimeSeconds: 900,
  maxBroadcastSeconds: 14_400,
  now: () => new Date('2026-09-01T12:00:00Z'),
  nextId: (() => {
    const ids = ['public-id', 'record-id']
    return () => ids.shift() ?? 'extra-id'
  })(),
  fetcher,
})

describe('OvenMediaLiveVideo', () => {
  it('returns a signed one-time ingest key and public adaptive playback URL', async () => {
    const live = new OvenMediaLiveVideo(config())
    const result = await live.provision({ name: 'en: Evening news' })
    const [stream = '', query = ''] = result.streamKey.split('?')
    const params = new URLSearchParams(query)
    const policy = params.get('policy') ?? ''
    const signedUrl = `rtmp://live.kurasikapa.tv:1935/app/${stream}?policy=${policy}`

    expect(result.channelArn).toBe('public-id:record-id')
    expect(result.ingestEndpoint).toBe('rtmp://live.kurasikapa.tv:1935/app')
    expect(result.playbackUrl).toBe('https://live.kurasikapa.tv:3334/app/public-id/master.m3u8')
    expect(JSON.parse(Buffer.from(policy, 'base64url').toString())).toEqual({
      stream_expire: 1_788_278_400,
      url_expire: 1_788_264_900,
    })
    expect(params.get('signature')).toBe(
      createHmac('sha1', 'signing-secret').update(signedUrl).digest('base64url'),
    )
  })

  it('reserves recording before the encoder connects', async () => {
    const fetcher = vi.fn(() => responseWith(200))
    await new OvenMediaLiveVideo(config(fetcher)).provision({ name: 'News' })

    expect(fetcher).toHaveBeenCalledWith(
      'http://ome.internal:8081/v1/vhosts/default/apps/app:startRecord',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'record-id', stream: { name: 'public-id', variantNames: [] } }),
      }),
    )
  })

  it('fails closed before returning credentials when recording cannot be reserved', async () => {
    const fetcher = vi.fn(() => responseWith(503))
    await expect(new OvenMediaLiveVideo(config(fetcher)).provision({ name: 'News' }))
      .rejects.toThrow(/reserve the recording/u)
  })

  it('stops recording and removes the stream, accepting already-gone responses', async () => {
    const fetcher = vi.fn(() => responseWith(404))
    await expect(new OvenMediaLiveVideo(config(fetcher)).teardown('public-id:record-id')).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('fails closed when required configuration is missing', async () => {
    await expect(new OvenMediaLiveVideo({ ...config(), signingSecret: '' }).provision({ name: 'News' }))
      .rejects.toBeInstanceOf(LiveVideoUnavailable)
  })

  it('refuses an ingest URL without the explicit port SignedPolicy requires', async () => {
    await expect(new OvenMediaLiveVideo({ ...config(), ingestUrl: 'rtmp://live.kurasikapa.tv/app' }).provision({ name: 'News' }))
      .rejects.toThrow(/explicit port/u)
  })
})
