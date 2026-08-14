import { Actor, type Broadcast, NotPermitted, broadcastId, userId } from '@kurasikapa/domain'
import { BROADCAST_STARTED_AT, aBroadcast } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import {
  InMemoryBroadcastRepository,
  UnfilteredBroadcastRepository,
} from '../testing/in-memory-broadcast-repository'
import { GetCurrentBroadcast } from './get-current-broadcast'
import { ListBroadcasts } from './list-broadcasts'

const PRODUCER = new Actor(userId('usr_producer'), ['video_editor'])
const EDITOR = new Actor(userId('usr_editor'), ['editor'])

const repo = (seed: readonly Broadcast[]): InMemoryBroadcastRepository =>
  new InMemoryBroadcastRepository(seed)

const at = (iso: string): Date => new Date(iso)

describe('GetCurrentBroadcast', () => {
  const live = aBroadcast()

  it('returns what is on air in the locale', async () => {
    const get = new GetCurrentBroadcast({ broadcasts: repo([live]) })

    expect(await get.execute({ locale: 'fr' })).toEqual({
      id: 'bcast_1',
      title: 'Journal de 20h',
      locale: 'fr',
      playbackUrl: live.playbackUrl,
      startedAt: BROADCAST_STARTED_AT,
    })
  })

  it('never exposes the channel handle or any credential', async () => {
    // A projection, not the aggregate: returning the Broadcast would put
    // channelArn one `.snapshot()` away from any page, cache entry or JSON
    // response that touches it, and that handle names the station's AWS estate.
    const get = new GetCurrentBroadcast({ broadcasts: repo([live]) })

    const current = await get.execute({ locale: 'fr' })

    expect(JSON.stringify(current)).not.toContain('arn:aws:ivs')
    expect(Object.keys(current ?? {})).toEqual(['id', 'title', 'locale', 'playbackUrl', 'startedAt'])
  })

  it('returns null when the locale is off air', async () => {
    const get = new GetCurrentBroadcast({ broadcasts: repo([live]) })

    expect(await get.execute({ locale: 'en' })).toBeNull()
  })

  it('returns null when there has never been a broadcast', async () => {
    const get = new GetCurrentBroadcast({ broadcasts: repo([]) })

    expect(await get.execute({ locale: 'fr' })).toBeNull()
  })

  it('re-checks the state the repository claimed to filter on', async () => {
    // A query that merely forgot its state predicate would put a scheduled — or
    // torn-down — broadcast on the front page. That mistake must not depend on
    // a database to catch, so the use case asks the aggregate itself.
    const ended = aBroadcast({ state: 'ended', endedAt: at('2026-08-14T20:15:00Z') })
    const unfiltered = new UnfilteredBroadcastRepository([ended])

    const get = new GetCurrentBroadcast({ broadcasts: unfiltered })

    expect(await get.execute({ locale: 'fr' })).toBeNull()
  })
})

describe('ListBroadcasts', () => {
  const schedule: readonly Broadcast[] = [
    aBroadcast({ id: broadcastId('b_early'), scheduledFor: at('2026-08-12T19:00:00Z') }),
    aBroadcast({ id: broadcastId('b_late'), scheduledFor: at('2026-08-14T19:00:00Z') }),
    aBroadcast({ id: broadcastId('b_en'), locale: 'en' }),
  ]

  const list = (): ListBroadcasts => new ListBroadcasts({ broadcasts: repo(schedule) })

  it('lists one locale, newest first', async () => {
    const rows = await list().execute({ actor: PRODUCER, locale: 'fr' })

    expect(rows.map((b) => b.id)).toEqual(['b_late', 'b_early'])
  })

  it('refuses an actor without stream:manage', async () => {
    // The studio list carries channelArn, which an operator needs to reconcile
    // against the AWS console and nobody else has any business reading.
    await expect(list().execute({ actor: EDITOR, locale: 'fr' })).rejects.toThrow(NotPermitted)
  })

  it('honours a requested limit', async () => {
    expect(await list().execute({ actor: PRODUCER, locale: 'fr', limit: 1 })).toHaveLength(1)
  })

  it('clamps a limit that would drag the whole history back', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      aBroadcast({ id: broadcastId(`b_${String(i)}`) }),
    )

    const rows = await new ListBroadcasts({ broadcasts: repo(many) }).execute({
      actor: PRODUCER,
      locale: 'fr',
      limit: 500,
    })

    expect(rows).toHaveLength(100)
  })

  it('falls back to a sane default when no limit is given', async () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      aBroadcast({ id: broadcastId(`b_${String(i)}`) }),
    )

    const rows = await new ListBroadcasts({ broadcasts: repo(many) }).execute({
      actor: PRODUCER,
      locale: 'fr',
    })

    expect(rows).toHaveLength(25)
  })
})
