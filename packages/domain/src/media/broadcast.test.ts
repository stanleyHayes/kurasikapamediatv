import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor'
import { broadcastId, userId } from '../shared/ids'
import { actorWith } from '../testing/builders'
import { Broadcast, type NewBroadcast } from './broadcast'
import { BROADCAST_STATES, type BroadcastState } from './broadcast-state'
import { AlreadyLive, BroadcastHasEnded, LiveCaptionsRequired, NotLive } from './errors'

const SCHEDULED_FOR = new Date('2026-08-14T19:00:00Z')
const START = new Date('2026-08-14T19:02:00Z')
const END = new Date('2026-08-14T20:15:00Z')

const PRODUCER = userId('usr_producer')

// `video_editor` and `administrator` hold stream:manage; `editor` does not.
// An editor runs the newspaper, not the transmitter — see identity/role.ts.
const producer = actorWith(['video_editor'], PRODUCER)
const admin = actorWith(['administrator'])
const editor = actorWith(['editor'])
const subscriber = actorWith(['subscriber'])

const input: NewBroadcast = {
  id: broadcastId('bcast_1'),
  title: 'Journal de 20h',
  locale: 'fr',
  channelArn: 'arn:aws:ivs:eu-west-3:000000000000:channel/abc123',
  playbackUrl: 'https://abc123.eu-west-3.playback.live-video.net/v1/master.m3u8',
  captionMode: 'in_band',
  scheduledFor: SCHEDULED_FOR,
}

const scheduled = (): Broadcast => Broadcast.schedule(producer, input)
const live = (): Broadcast => scheduled().goLive(producer, START)
const ended = (): Broadcast => live().end(producer, END)

/** Any state, without walking the machine to reach it. */
const inState = (state: BroadcastState): Broadcast =>
  Broadcast.reconstitute({
    ...input,
    state,
    startedAt: state === 'scheduled' ? null : START,
    endedAt: state === 'ended' ? END : null,
    createdBy: PRODUCER,
  })

describe('schedule', () => {
  it('starts life scheduled, with no start and no end', () => {
    const props = scheduled().snapshot()

    expect(props.state).toBe('scheduled')
    expect(props.startedAt).toBeNull()
    expect(props.endedAt).toBeNull()
  })

  it('attributes the broadcast to whoever scheduled it, not to a passed-in id', () => {
    expect(scheduled().createdBy).toBe(PRODUCER)
  })

  it('keeps the channel it was provisioned against', () => {
    expect(scheduled().channelArn).toBe(input.channelArn)
    expect(scheduled().playbackUrl).toBe(input.playbackUrl)
    expect(scheduled().captionMode).toBe('in_band')
  })

  it('refuses to schedule a live channel without synchronized captions', () => {
    expect(() => Broadcast.schedule(producer, { ...input, captionMode: 'none' as 'in_band' })).toThrow(LiveCaptionsRequired)
  })

  it('admits an administrator', () => {
    expect(Broadcast.schedule(admin, input).state).toBe('scheduled')
  })

  it('refuses an editor, who may publish articles but not run the transmitter', () => {
    // The station's air is not the newspaper. `stream:manage` is held by
    // video_editor, administrator and super_admin — deliberately not by editor.
    expect(() => Broadcast.schedule(editor, input)).toThrow(NotPermitted)
  })

  it('refuses a subscriber', () => {
    expect(() => Broadcast.schedule(subscriber, input)).toThrow(NotPermitted)
  })
})

describe('goLive', () => {
  it('takes a scheduled broadcast on air and stamps the moment', () => {
    const onAir = live()

    expect(onAir.state).toBe('live')
    expect(onAir.startedAt).toEqual(START)
    expect(onAir.isLive()).toBe(true)
  })

  it('refuses a broadcast that is already live', () => {
    // A second goLive would move startedAt forward, and "how long have we been
    // on air" is the number the gallery reads off the studio screen.
    expect(() => live().goLive(producer, END)).toThrow(AlreadyLive)
  })

  it('refuses a broadcast that has ended', () => {
    // Ending tears the IVS channel down, so channelArn names a resource that no
    // longer exists. Resuming would point every viewer at nothing.
    expect(() => ended().goLive(producer, END)).toThrow(BroadcastHasEnded)
  })

  it('refuses an actor without stream:manage', () => {
    expect(() => scheduled().goLive(editor, START)).toThrow(NotPermitted)
  })

  it('reports missing permission before state, so it leaks no schedule', () => {
    // A subscriber is both unpermitted and asking the impossible. They are told
    // the former — "already live" confirms the station is on air and when.
    expect(() => live().goLive(subscriber, END)).toThrow(NotPermitted)
  })

  it('leaves the original untouched', () => {
    const before = scheduled()
    before.goLive(producer, START)

    expect(before.state).toBe('scheduled')
    expect(before.startedAt).toBeNull()
  })
})

describe('end', () => {
  it('ends a live broadcast and stamps the moment', () => {
    const off = ended()

    expect(off.state).toBe('ended')
    expect(off.endedAt).toEqual(END)
    expect(off.isLive()).toBe(false)
  })

  it('keeps the moment it started, so the duration survives', () => {
    expect(ended().startedAt).toEqual(START)
  })

  it('refuses a broadcast that never went live', () => {
    // Ending is what triggers channel teardown. Allowing it from `scheduled`
    // would demolish a channel an operator is still cabling up.
    expect(() => scheduled().end(producer, END)).toThrow(NotLive)
  })

  it('names the state it refused', () => {
    expect(() => scheduled().end(producer, END)).toThrow('"scheduled"')
  })

  it('refuses a broadcast that has already ended', () => {
    // A second end would tear down a channel whose ARN may have been reissued.
    expect(() => ended().end(producer, END)).toThrow(NotLive)
  })

  it('refuses an actor without stream:manage', () => {
    expect(() => live().end(editor, END)).toThrow(NotPermitted)
  })

  it('reports missing permission before state', () => {
    expect(() => scheduled().end(subscriber, END)).toThrow(NotPermitted)
  })

  it('leaves the original untouched', () => {
    const before = live()
    before.end(producer, END)

    expect(before.state).toBe('live')
    expect(before.endedAt).toBeNull()
  })
})

describe('isLive', () => {
  // Driven off BROADCAST_STATES rather than three hand-written cases: a fourth
  // state added later is answered here on the day it is added, instead of
  // silently defaulting to "not on air" in whatever the front page asks.
  it.each(BROADCAST_STATES)('answers for state "%s"', (state) => {
    expect(inState(state).isLive()).toBe(state === 'live')
  })
})

describe('identity', () => {
  it('exposes what a player and a studio row are built from', () => {
    const onAir = live()

    expect(onAir.id).toBe('bcast_1')
    expect(onAir.title).toBe('Journal de 20h')
    expect(onAir.locale).toBe('fr')
    expect(onAir.scheduledFor).toEqual(SCHEDULED_FOR)
    expect(onAir.playbackUrl).toBe(input.playbackUrl)
    expect(onAir.channelArn).toBe(input.channelArn)
    expect(onAir.createdBy).toBe(PRODUCER)
  })

  it('carries no credential a database dump could leak', () => {
    // The stream key lets anyone broadcast as the station. It is handed to the
    // operator once at provision time and never persisted — the day it becomes
    // a prop "for convenience" it is in every backup and every log line.
    expect(Object.keys(live().snapshot())).not.toContain('streamKey')
  })
})

describe('reconstitute', () => {
  it('rebuilds from storage without re-applying the schedule rules', () => {
    // A broadcast that went live yesterday stays live when read back today,
    // whoever is reading. Ending it is an operator decision, not a side effect
    // of a query — and the read carries no Actor to check anyway.
    const stored = Broadcast.reconstitute({
      ...input,
      state: 'live',
      startedAt: START,
      endedAt: null,
      createdBy: PRODUCER,
    })

    expect(stored.state).toBe('live')
    expect(stored.startedAt).toEqual(START)
    expect(stored.endedAt).toBeNull()
  })
})
