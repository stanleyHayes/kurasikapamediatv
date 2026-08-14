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

interface Wiring {
  readonly broadcasts: InMemoryBroadcastRepository
  readonly live: FakeLiveVideo
  readonly end: EndBroadcast
}

const wiring = (state: 'scheduled' | 'live' | 'ended' = 'live'): Wiring => {
  const broadcasts = new InMemoryBroadcastRepository([aBroadcast({ state })])
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

  it('records the end before it releases the channel', async () => {
    // The other order leaves a record saying "live" against a channel that no
    // longer exists whenever the save fails: `currentLive` keeps serving it and
    // every reader gets a player that spins forever. This way the worst case is
    // a channel that outlives its record — billing, but visible and reapable.
    const live = new FakeLiveVideo()
    const end = new EndBroadcast({
      broadcasts: new ExplodingBroadcastRepository([aBroadcast()]),
      live,
      clock: new FakeClock(END),
    })

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).rejects.toThrow(
      STORE_UNAVAILABLE,
    )
    expect(live.tornDown).toHaveLength(0)
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

  it('refuses to end the same broadcast twice', async () => {
    const { end, live } = wiring('ended')

    await expect(end.execute({ actor: PRODUCER, broadcastId: BCAST })).rejects.toThrow(NotLive)
    expect(live.tornDown).toHaveLength(0)
  })
})
