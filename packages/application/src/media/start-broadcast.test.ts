import { Actor, type Broadcast, NotPermitted, broadcastId, userId } from '@kurasikapa/domain'
import { aBroadcast } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { FailClosedLiveVideo, FakeLiveVideo } from '../testing/fake-live-video'
import { FakeClock, SequentialIds } from '../testing/fakes'
import {
  ExplodingBroadcastRepository,
  InMemoryBroadcastRepository,
  STORE_UNAVAILABLE,
} from '../testing/in-memory-broadcast-repository'
import { AlreadyBroadcasting } from './errors'
import { StartBroadcast } from './start-broadcast'

const NOW = new Date('2026-08-14T19:02:00Z')
const CHANNEL_1 = 'arn:aws:ivs:eu-west-3:000000000000:channel/ch_1'

const PRODUCER = new Actor(userId('usr_producer'), ['video_editor'])
const EDITOR = new Actor(userId('usr_editor'), ['editor'])

const goLive = { actor: PRODUCER, title: 'Journal de 20h', locale: 'fr' }

/** Already on air in `locale`, under an id the SequentialIds prefix cannot collide with. */
const onAir = (locale: string, state: Broadcast['state'] = 'live'): Broadcast =>
  aBroadcast({ id: broadcastId(`seed_${locale}`), locale, state })

const startWith = (broadcasts: InMemoryBroadcastRepository, live: FakeLiveVideo | FailClosedLiveVideo): StartBroadcast =>
  new StartBroadcast({ broadcasts, live, clock: new FakeClock(NOW), ids: new SequentialIds('bcast') })

interface Wiring {
  readonly broadcasts: InMemoryBroadcastRepository
  readonly live: FakeLiveVideo
  readonly start: StartBroadcast
}

const wiring = (seed: readonly Broadcast[] = []): Wiring => {
  const broadcasts = new InMemoryBroadcastRepository(seed)
  const live = new FakeLiveVideo()

  return { broadcasts, live, start: startWith(broadcasts, live) }
}

describe('StartBroadcast', () => {
  it('provisions a channel and records the broadcast as live', async () => {
    const { start, broadcasts, live } = wiring()

    const result = await start.execute(goLive)

    expect(live.provisioned).toEqual([{ name: 'fr: Journal de 20h' }])
    expect(result.broadcastId).toBe('bcast_1')
    expect((await broadcasts.findById(broadcastId('bcast_1')))?.state).toBe('live')
  })

  it('returns the ingest endpoint, playback url and stream key', async () => {
    const result = await wiring().start.execute(goLive)

    expect(result.ingestEndpoint).toContain('rtmps://')
    expect(result.playbackUrl).toContain('master.m3u8')
    expect(result.streamKey).toBe('sk_test_1')
  })

  it('never persists the stream key', async () => {
    // The rule the whole port doc exists for: the key authenticates an RTMPS
    // ingest with no second factor, so a copy in Mongo is a copy of the
    // station's air. It reaches the operator once and is then forgotten.
    const { start, broadcasts } = wiring()

    const result = await start.execute(goLive)
    const stored = await broadcasts.findById(result.broadcastId)

    expect(JSON.stringify(stored?.snapshot())).not.toContain(result.streamKey)
  })

  it('stamps the start from the clock, not the wall', async () => {
    const { start, broadcasts } = wiring()

    const { broadcastId: id } = await start.execute(goLive)

    expect((await broadcasts.findById(id))?.startedAt).toEqual(NOW)
  })

  it('refuses an actor without stream:manage before it provisions anything', async () => {
    // The check must precede the provider call: the aggregate cannot run until
    // a channel exists to name, so leaning on its check alone would create — and
    // bill for — a channel for a request that was always going to be refused.
    const { start, live } = wiring()

    await expect(start.execute({ ...goLive, actor: EDITOR })).rejects.toThrow(NotPermitted)
    expect(live.provisioned).toHaveLength(0)
  })

  it('refuses a second broadcast while the locale is already on air', async () => {
    const { start, live } = wiring([onAir('fr')])

    await expect(start.execute(goLive)).rejects.toThrow(AlreadyBroadcasting)
    expect(live.provisioned).toHaveLength(0)
  })

  it('lets another locale go on air alongside', async () => {
    const { start } = wiring([onAir('fr')])

    await expect(start.execute({ ...goLive, locale: 'en' })).resolves.toBeDefined()
  })

  it('does not count a broadcast that has already ended', async () => {
    const { start } = wiring([onAir('fr', 'ended')])

    await expect(start.execute(goLive)).resolves.toBeDefined()
  })

  it('tears the channel down when the broadcast cannot be recorded', async () => {
    // An unrecorded channel is unreachable: no row holds its ARN, so no
    // EndBroadcast will ever release it and it bills until a human finds it.
    const live = new FakeLiveVideo()
    const start = startWith(new ExplodingBroadcastRepository(), live)

    await expect(start.execute(goLive)).rejects.toThrow(STORE_UNAVAILABLE)
    expect(live.tornDown).toEqual([CHANNEL_1])
  })

  it('lets the original failure win when the cleanup itself fails', async () => {
    // The caller needs to know why the start failed. A teardown error thrown on
    // top would replace that answer with a less useful one.
    const live = new FakeLiveVideo(true)
    const start = startWith(new ExplodingBroadcastRepository(), live)

    await expect(start.execute(goLive)).rejects.toThrow(STORE_UNAVAILABLE)
    expect(live.tornDown).toEqual([CHANNEL_1])
  })

  it('fails closed, and records nothing, when the provider is unconfigured', async () => {
    const broadcasts = new InMemoryBroadcastRepository()

    await expect(startWith(broadcasts, new FailClosedLiveVideo()).execute(goLive)).rejects.toThrow(
      'AWS_ACCESS_KEY_ID is unset',
    )
    expect(broadcasts.count()).toBe(0)
  })
})
