import { Actor, NotLive, NotPermitted, broadcastId, userId } from '@kurasikapa/domain'
import { aBroadcast } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { FakeLiveVideo } from '../testing/fake-live-video'
import { FakeClock } from '../testing/fakes'
import {
  ExplodingBroadcastRepository,
  InMemoryBroadcastRepository,
  STORE_UNAVAILABLE,
} from '../testing/in-memory-broadcast-repository'
import { EndBroadcast } from './end-broadcast'
import { BroadcastNotFound } from './errors'

const END = new Date('2026-08-14T20:15:00Z')
const CHANNEL = 'arn:aws:ivs:eu-west-3:000000000000:channel/abc123'

const PRODUCER = new Actor(userId('usr_producer'), ['video_editor'])
const EDITOR = new Actor(userId('usr_editor'), ['editor'])

const BCAST = broadcastId('bcast_1')

class FailsOnceBroadcastRepository extends InMemoryBroadcastRepository {
  private failed = false
  override save(broadcast: Parameters<InMemoryBroadcastRepository['save']>[0]): Promise<void> {
    if (!this.failed) {
      this.failed = true
      return Promise.reject(new Error(STORE_UNAVAILABLE))
    }
    return super.save(broadcast)
  }
}

interface Wiring {
  readonly broadcasts: InMemoryBroadcastRepository
  readonly live: FakeLiveVideo
  readonly end: EndBroadcast
}

const wiring = (state: 'scheduled' | 'live' | 'ended' = 'live'): Wiring => {
  const broadcasts = new InMemoryBroadcastRepository([
    aBroadcast({ state, endedAt: state === 'ended' ? END : null }),
  ])
  const live = new FakeLiveVideo()

  return { broadcasts, live, end: new EndBroadcast({ broadcasts, live, clock: new FakeClock(END) }) }
}

describe('EndBroadcast', () => {
  it('takes the broadcast off air and stamps the moment', async () => {
    const { end, broadcasts } = wiring()

    const result = await end.execute({ actor: PRODUCER, broadcastId: BCAST })

    expect(result).toEqual({ broadcastId: BCAST, endedAt: END })
    expect((await broadcasts.findById(BCAST))?.state).toBe('ended')
  })

  it('releases the channel', async () => {
    const { end, live } = wiring()

    await end.execute({ actor: PRODUCER, broadcastId: BCAST })

    expect(live.tornDown).toEqual([CHANNEL])
  })

  it('releases the channel before recording the end', async () => {
    const live = new FakeLiveVideo()
    const end = new EndBroadcast({
      broadcasts: new ExplodingBroadcastRepository([aBroadcast()]),
      live,
      clock: new FakeClock(END),
    })

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).rejects.toThrow(
      STORE_UNAVAILABLE,
    )
    expect(live.tornDown).toEqual([CHANNEL])
  })

  it('stops answering as the current broadcast', async () => {
    const { end, broadcasts } = wiring()

    await end.execute({ actor: PRODUCER, broadcastId: BCAST })

    expect(await broadcasts.currentLive('fr')).toBeNull()
  })

  it('surfaces a failed teardown rather than reporting a clean stop', async () => {
    // The broadcast is off air either way, so "done" would be defensible — but
    // then a live channel bills on with nobody aware. An error an operator can
    // retry is the cheaper outcome, and teardown is idempotent.
    const broadcasts = new InMemoryBroadcastRepository([aBroadcast()])
    const end = new EndBroadcast({
      broadcasts,
      live: new FakeLiveVideo(true),
      clock: new FakeClock(END),
    })

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).rejects.toThrow(
      'teardown refused',
    )
    expect((await broadcasts.findById(BCAST))?.state).toBe('live')
  })

  it('retries safely when provider teardown succeeded but saving ended failed', async () => {
    const broadcasts = new FailsOnceBroadcastRepository([aBroadcast()])
    const live = new FakeLiveVideo()
    const end = new EndBroadcast({ broadcasts, live, clock: new FakeClock(END) })

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).rejects.toThrow(
      STORE_UNAVAILABLE,
    )
    expect((await broadcasts.findById(BCAST))?.state).toBe('live')
    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).resolves.toBeDefined()
    expect(live.tornDown).toEqual([CHANNEL, CHANNEL])
    expect((await broadcasts.findById(BCAST))?.state).toBe('ended')
  })

  it('refuses an unknown broadcast', async () => {
    await expect(
      wiring().end.execute({ actor: PRODUCER, broadcastId: broadcastId('bcast_missing') }),
    ).rejects.toThrow(BroadcastNotFound)
  })

  it('refuses an actor without stream:manage, and leaves the channel up', async () => {
    const { end, live, broadcasts } = wiring()

    await expect(end.execute({ actor: EDITOR, broadcastId: BCAST })).rejects.toThrow(NotPermitted)
    expect(live.tornDown).toHaveLength(0)
    expect((await broadcasts.findById(BCAST))?.state).toBe('live')
  })

  it('refuses a broadcast that never went live', async () => {
    const { end, live } = wiring('scheduled')

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).rejects.toThrow(NotLive)
    expect(live.tornDown).toHaveLength(0)
  })

  it('retries provider cleanup for an already-ended broadcast', async () => {
    const { end, live } = wiring('ended')

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).resolves.toMatchObject({
      broadcastId: BCAST,
    })
    expect(live.tornDown).toEqual([CHANNEL])
  })

  it('keeps cleanup retry permission-protected', async () => {
    const { end, live } = wiring('ended')

    await expect(end.execute({ actor: EDITOR, broadcastId: BCAST })).rejects.toThrow(NotPermitted)
    expect(live.tornDown).toHaveLength(0)
  })
})
