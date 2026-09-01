import { Broadcast, type BroadcastProps, broadcastId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { BROADCASTS, type BroadcastDocument } from './documents'
import { MongoBroadcastRepository } from './mongo-broadcast-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoBroadcastRepository
let started = false

beforeAll(async () => {
  mongo = await startMongo()
  started = true
  repo = new MongoBroadcastRepository(mongo.db)
})

afterEach(async () => {
  if (started) await mongo.reset()
})

afterAll(async () => {
  if (started) await mongo.stop()
})

const EVENING = new Date('2026-08-13T19:00:00Z')
const LATE = new Date('2026-08-13T22:00:00Z')
const TOMORROW = new Date('2026-08-14T19:00:00Z')

const broadcast = (id: string, patch: Partial<BroadcastProps> = {}): Broadcast =>
  Broadcast.reconstitute({
    id: broadcastId(id),
    title: 'Evening bulletin',
    locale: 'en',
    channelArn: 'arn:aws:ivs:eu-west-3:000000000000:channel/AbCdEf',
    playbackUrl: 'https://cdn.example.com/en/master.m3u8',
    captionMode: 'in_band',
    state: 'scheduled',
    scheduledFor: EVENING,
    startedAt: null,
    endedAt: null,
    createdBy: userId('usr_gallery'),
    ...patch,
  })

const live = (id: string, patch: Partial<BroadcastProps> = {}): Broadcast =>
  broadcast(id, { state: 'live', startedAt: EVENING, ...patch })

describe('round trip', () => {
  it('preserves every field', async () => {
    const original = live('bc_1')
    await repo.save(original)

    const loaded = await repo.findById(broadcastId('bc_1'))

    expect(loaded?.snapshot()).toEqual(original.snapshot())
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(broadcastId('bc_missing'))).toBeNull()
  })

  it('writes the transition in place rather than duplicating', async () => {
    // Every transition returns a new Broadcast carrying the same id. A save
    // that inserted instead of upserting would leave the old `scheduled` row
    // behind, and `currentLive` would then be choosing between two truths.
    await repo.save(broadcast('bc_1'))
    await repo.save(live('bc_1'))

    expect(await mongo.db.collection(BROADCASTS).countDocuments()).toBe(1)
    expect((await repo.findById(broadcastId('bc_1')))?.isLive()).toBe(true)
  })
})

describe('currentLive', () => {
  it('returns whatever is on air', async () => {
    await repo.save(live('bc_live'))

    expect((await repo.currentLive('en'))?.id).toBe('bc_live')
  })

  it('ignores a broadcast that has only been scheduled', async () => {
    // The player would load a manifest for a channel nobody is ingesting to.
    await repo.save(broadcast('bc_soon'))

    expect(await repo.currentLive('en')).toBeNull()
  })

  it('ignores a broadcast that has ended', async () => {
    // Ending is what tears the channel down, so an ended broadcast on the front
    // page is a player pointed at a resource that no longer exists.
    await repo.save(broadcast('bc_done', { state: 'ended', startedAt: EVENING, endedAt: LATE }))

    expect(await repo.currentLive('en')).toBeNull()
  })

  it('answers per locale — the French bulletin is not the English one', async () => {
    // Product rule 3: locale is data. A live French broadcast must not put the
    // English homepage on air, and vice versa.
    await repo.save(live('bc_fr', { locale: 'fr', playbackUrl: 'https://cdn.example.com/fr.m3u8' }))

    expect(await repo.currentLive('en')).toBeNull()
    expect((await repo.currentLive('fr'))?.id).toBe('bc_fr')
  })
})

describe('one live broadcast per locale', () => {
  it('guarantees the live uniqueness index before its first operation', async () => {
    await mongo.db.collection(BROADCASTS).dropIndex('broadcast_live_per_locale_unique')
    const guarded = new MongoBroadcastRepository(mongo.db)

    await guarded.currentLive('en')

    const indexes = await mongo.db.collection(BROADCASTS).indexes()
    expect(indexes.map(({ name }) => name)).toContain('broadcast_live_per_locale_unique')
  })

  it('refuses a second live broadcast in the same locale', async () => {
    // StartBroadcast reads `currentLive`, sees null, then writes. Two operators
    // pressing "go live" in the same second both read null, so the database is
    // the only thing standing between the station and two billing channels
    // with the front page picking one at random.
    await repo.save(live('bc_first'))

    await expect(repo.save(live('bc_second'))).rejects.toThrow(/duplicate key/i)
  })

  it('leaves the incumbent on air when the loser is rejected', async () => {
    await repo.save(live('bc_first'))
    await repo.save(live('bc_second')).catch(() => undefined)

    expect((await repo.currentLive('en'))?.id).toBe('bc_first')
    expect(await mongo.db.collection(BROADCASTS).countDocuments()).toBe(1)
  })

  it('lets each locale be on air at once', async () => {
    await repo.save(live('bc_en'))
    await repo.save(live('bc_fr', { locale: 'fr' }))

    expect((await repo.currentLive('en'))?.id).toBe('bc_en')
    expect((await repo.currentLive('fr'))?.id).toBe('bc_fr')
  })

  it('keeps a locale its whole history', async () => {
    // The uniqueness is partial on `state`. If it were not, the second night's
    // bulletin could never be recorded — which is the failure mode a plain
    // unique index on `locale` would ship.
    await repo.save(broadcast('bc_mon', { state: 'ended', startedAt: EVENING, endedAt: LATE }))
    await repo.save(broadcast('bc_tue', { state: 'ended', startedAt: EVENING, endedAt: LATE }))

    expect(await repo.list('en', 10)).toHaveLength(2)
  })

  it('lets tomorrow be scheduled while tonight is on air', async () => {
    await repo.save(live('bc_tonight'))
    await repo.save(broadcast('bc_tomorrow', { scheduledFor: TOMORROW }))

    expect((await repo.currentLive('en'))?.id).toBe('bc_tonight')
  })
})

describe('list', () => {
  it('returns the locale newest scheduled first', async () => {
    await repo.save(broadcast('bc_tonight'))
    await repo.save(broadcast('bc_tomorrow', { scheduledFor: TOMORROW }))

    const rows = await repo.list('en', 10)

    expect(rows.map((b) => b.id)).toEqual(['bc_tomorrow', 'bc_tonight'])
  })

  it('honours the limit', async () => {
    for (let i = 0; i < 4; i++) {
      await repo.save(broadcast(`bc_${String(i)}`, { scheduledFor: new Date(EVENING.getTime() + i) }))
    }

    expect(await repo.list('en', 2)).toHaveLength(2)
  })

  it('never leaks another locale into the list', async () => {
    await repo.save(broadcast('bc_en'))
    await repo.save(broadcast('bc_fr', { locale: 'fr' }))

    expect((await repo.list('en', 10)).map((b) => b.id)).toEqual(['bc_en'])
  })

  it('shows scheduled, live and ended alike — the studio screen is where they are managed', async () => {
    await repo.save(broadcast('bc_soon', { scheduledFor: TOMORROW }))
    await repo.save(live('bc_now'))
    await repo.save(broadcast('bc_done', { state: 'ended', startedAt: EVENING, endedAt: LATE }))

    expect(await repo.list('en', 10)).toHaveLength(3)
  })
})

describe('the stream key', () => {
  it('never reaches storage', async () => {
    // Asserted on the whole key set rather than on the absence of one name, so
    // that adding *any* field to the document is a decision somebody has to
    // make here. The key lets its holder broadcast as the station; a copy in
    // every nightly backup is the thing this test exists to prevent, and a
    // hashed copy would earn nothing because nothing ever verifies one.
    await repo.save(live('bc_1'))

    const raw = await mongo.db.collection<BroadcastDocument>(BROADCASTS).findOne({ _id: 'bc_1' })

    expect(Object.keys(raw ?? {}).sort()).toEqual([
      '_id',
      'captionMode',
      'channelArn',
      'createdBy',
      'endedAt',
      'locale',
      'playbackUrl',
      'scheduledFor',
      'startedAt',
      'state',
      'title',
    ])
  })
})
