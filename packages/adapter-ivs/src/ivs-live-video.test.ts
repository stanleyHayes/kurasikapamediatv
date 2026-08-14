import {
  ResourceNotFoundException,
  ThrottlingException,
  type CreateChannelCommandInput,
  type CreateChannelCommandOutput,
  type DeleteChannelCommandInput,
  type DeleteChannelCommandOutput,
} from '@aws-sdk/client-ivs'
import { describe, expect, it } from 'vitest'
import { failClosedIvs } from './fail-closed-ivs'
import { ivsChannels, type IvsChannels } from './ivs-channels'
import { IvsLiveVideo } from './ivs-live-video'

const STREAM_KEY = 'sk_live_do_not_log_me'
const ARN = 'arn:aws:ivs:eu-west-1:000000000000:channel/ch_1'

/** A response shaped exactly as IVS sends one: bare ingest host, key alongside. */
const CREATED: CreateChannelCommandOutput = {
  $metadata: {},
  channel: {
    arn: ARN,
    name: 'en: Evening News',
    ingestEndpoint: 'a1b2c3d4e5f6.global-contribute.live-video.net',
    playbackUrl: 'https://a1b2c3d4e5f6.eu-west-1.playback.live-video.net/v1/master.m3u8',
  },
  streamKey: { arn: `${ARN}/streamKey/sk_1`, value: STREAM_KEY, channelArn: ARN },
}

/**
 * The IVS seam, hand-written. It records what was asked of AWS so a test can
 * assert the thing that matters — that nothing was created before the
 * credential check refused, and that a teardown reached the right ARN.
 */
class FakeIvsChannels implements IvsChannels {
  readonly created: CreateChannelCommandInput[] = []
  readonly deleted: (string | undefined)[] = []

  constructor(
    private readonly response: CreateChannelCommandOutput = CREATED,
    private readonly deleteFails?: Error,
  ) {}

  createChannel(input: CreateChannelCommandInput): Promise<CreateChannelCommandOutput> {
    this.created.push(input)

    return Promise.resolve(this.response)
  }

  deleteChannel(input: DeleteChannelCommandInput): Promise<DeleteChannelCommandOutput> {
    this.deleted.push(input.arn)

    return this.deleteFails === undefined
      ? Promise.resolve({ $metadata: {} })
      : Promise.reject(this.deleteFails)
  }
}

function live(channels: IvsChannels): IvsLiveVideo {
  return new IvsLiveVideo({
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secret',
    channels,
  })
}

function withoutChannelField(field: 'arn' | 'ingestEndpoint' | 'playbackUrl'): FakeIvsChannels {
  return new FakeIvsChannels({ ...CREATED, channel: { ...CREATED.channel, [field]: undefined } })
}

describe('IvsLiveVideo', () => {
  it('fails closed when the access key id is unset', async () => {
    const channels = new FakeIvsChannels()
    const ivs = new IvsLiveVideo({
      accessKeyId: undefined,
      secretAccessKey: 'secret',
      channels,
    })

    await expect(ivs.provision({ name: 'en: Evening News' })).rejects.toThrow(/AWS_ACCESS_KEY_ID/u)
    // The refusal has to land before AWS is touched: a channel created for a
    // request we then reject bills by the hour with nothing pointing at it.
    expect(channels.created).toHaveLength(0)
  })

  it('fails closed when the secret access key is unset', async () => {
    const ivs = new IvsLiveVideo({
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: undefined,
      channels: new FakeIvsChannels(),
    })

    await expect(ivs.provision({ name: 'en: Evening News' })).rejects.toThrow(
      /AWS_SECRET_ACCESS_KEY/u,
    )
  })

  it('fails closed on teardown too, rather than reporting a channel released', async () => {
    const channels = new FakeIvsChannels()
    const ivs = new IvsLiveVideo({ accessKeyId: undefined, secretAccessKey: undefined, channels })

    await expect(ivs.teardown(ARN)).rejects.toThrow(/AWS_ACCESS_KEY_ID/u)
    expect(channels.deleted).toHaveLength(0)
  })

  it('provisions a channel and returns what the operator needs to go on air', async () => {
    const channels = new FakeIvsChannels()

    await expect(live(channels).provision({ name: 'en: Evening News' })).resolves.toEqual({
      channelArn: ARN,
      ingestEndpoint: 'rtmps://a1b2c3d4e5f6.global-contribute.live-video.net:443/app/',
      streamKey: STREAM_KEY,
      playbackUrl: 'https://a1b2c3d4e5f6.eu-west-1.playback.live-video.net/v1/master.m3u8',
    })
  })

  it('leaves an ingest endpoint that already carries a scheme alone', async () => {
    const endpoint = 'rtmps://already.global-contribute.live-video.net:443/app/'
    const channels = new FakeIvsChannels({
      ...CREATED,
      channel: { ...CREATED.channel, ingestEndpoint: endpoint },
    })

    await expect(live(channels).provision({ name: 'en: Evening News' })).resolves.toMatchObject({
      ingestEndpoint: endpoint,
    })
  })

  it('asks for a transcoded, low-latency, publicly playable channel', async () => {
    const channels = new FakeIvsChannels()

    await live(channels).provision({ name: 'en: Evening News' })

    expect(channels.created).toEqual([
      { name: 'en: Evening News', type: 'STANDARD', latencyMode: 'LOW', authorized: false },
    ])
  })

  it('refuses a channel with no ARN, which nothing could ever tear down', async () => {
    await expect(live(withoutChannelField('arn')).provision({ name: 'x' })).rejects.toThrow(
      /no ARN/u,
    )
  })

  it('refuses a channel with no ingest endpoint', async () => {
    await expect(
      live(withoutChannelField('ingestEndpoint')).provision({ name: 'x' }),
    ).rejects.toThrow(/no ingest endpoint/u)
  })

  it('refuses a channel with no playback URL', async () => {
    await expect(live(withoutChannelField('playbackUrl')).provision({ name: 'x' })).rejects.toThrow(
      /no playback URL/u,
    )
  })

  it('refuses a channel with no stream key', async () => {
    const channels = new FakeIvsChannels({ ...CREATED, streamKey: {} })

    await expect(live(channels).provision({ name: 'x' })).rejects.toThrow(/no stream key/u)
  })

  it('never puts the stream key into the error it throws', async () => {
    const channels = withoutChannelField('playbackUrl')

    const error: unknown = await live(channels)
      .provision({ name: 'x' })
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).not.toContain(STREAM_KEY)
  })

  it('tears the channel down by ARN', async () => {
    const channels = new FakeIvsChannels()

    await live(channels).teardown(ARN)

    expect(channels.deleted).toEqual([ARN])
  })

  it('treats an already-deleted channel as torn down', async () => {
    const gone = new ResourceNotFoundException({ $metadata: {}, message: 'channel not found' })
    const channels = new FakeIvsChannels(CREATED, gone)

    await expect(live(channels).teardown(ARN)).resolves.toBeUndefined()
  })

  it('surfaces a teardown failure that is not "already gone"', async () => {
    const throttled = new ThrottlingException({ $metadata: {}, message: 'slow down' })
    const channels = new FakeIvsChannels(CREATED, throttled)

    // A channel that survived the call is still billing. Swallowing this would
    // throw away the only signal that it is up.
    await expect(live(channels).teardown(ARN)).rejects.toThrow(/slow down/u)
  })
})

describe('failClosedIvs', () => {
  it('refuses to provision', async () => {
    await expect(failClosedIvs().provision({ name: 'en: Evening News' })).rejects.toThrow(
      /Live video is not configured/u,
    )
  })

  it('refuses to tear down', async () => {
    await expect(failClosedIvs().teardown(ARN)).rejects.toThrow(/Live video is not configured/u)
  })
})

describe('ivsChannels', () => {
  it('builds a client that speaks the two calls the adapter makes', () => {
    // Construction alone reaches nothing and resolves no credentials, which is
    // what lets the composition root build one before knowing whether AWS is
    // configured.
    const channels = ivsChannels('eu-west-1')

    expect(typeof channels.createChannel).toBe('function')
    expect(typeof channels.deleteChannel).toBe('function')
  })
})
