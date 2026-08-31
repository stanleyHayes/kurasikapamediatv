import {
  Presenter,
  Programme,
  ScheduleSlot,
  assetId,
  presenterId,
  programmeId,
  scheduleSlotId,
  userId,
} from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoPresenterRepository } from './mongo-presenter-repository'
import { MongoProgrammeRepository } from './mongo-programme-repository'
import { MongoScheduleRepository } from './mongo-schedule-repository'
import { PROGRAMMES, type ProgrammeDocument } from './television-documents'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let presenters: MongoPresenterRepository
let programmes: MongoProgrammeRepository
let schedule: MongoScheduleRepository
let started = false

beforeAll(async () => {
  mongo = await startMongo()
  started = true
  presenters = new MongoPresenterRepository(mongo.db)
  programmes = new MongoProgrammeRepository(mongo.db)
  schedule = new MongoScheduleRepository(mongo.db)
})
afterEach(async () => { if (started) await mongo.reset() })
afterAll(async () => { if (started) await mongo.stop() })

const presenter = (id: string, published = true, locale = 'en'): Presenter => Presenter.reconstitute({
  id: presenterId(id), name: id, slug: id, locale, role: 'Host', biography: 'A verified station presenter.',
  portraitAssetId: assetId(`${id}_portrait`), published, createdBy: userId('usr_producer'),
})

const programme = (id: string, published = true, locale = 'en'): Programme => Programme.reconstitute({
  id: programmeId(id), title: id, slug: id, locale, summary: 'A station programme.', category: 'News',
  presenterIds: [presenterId('ama')], artworkAssetId: assetId(`${id}_art`), published,
  createdBy: userId('usr_producer'),
})

const airing = (id: string, startsAt: Date, state: 'scheduled' | 'completed', locale = 'en'): ScheduleSlot =>
  ScheduleSlot.reconstitute({
    id: scheduleSlotId(id), programmeId: programmeId('news'), locale, startsAt,
    endsAt: new Date(startsAt.getTime() + 3_600_000), isLive: true, state,
    replayAssetId: state === 'completed' ? assetId(`${id}_video`) : null,
    captionAssetId: state === 'completed' ? assetId(`${id}_captions`) : null,
    createdBy: userId('usr_producer'),
  })

describe('television repositories', () => {
  it('round-trips presenter and programme records', async () => {
    await presenters.save(presenter('ama'))
    await programmes.save(programme('news'))

    expect((await presenters.findById(presenterId('ama')))?.snapshot()).toEqual(presenter('ama').snapshot())
    expect((await programmes.findById(programmeId('news')))?.snapshot()).toEqual(programme('news').snapshot())
  })

  it('returns null for unknown identifiers', async () => {
    expect(await presenters.findById(presenterId('missing'))).toBeNull()
    expect(await programmes.findById(programmeId('missing'))).toBeNull()
    expect(await schedule.findById(scheduleSlotId('missing'))).toBeNull()
  })

  it('lists only published records in their locale', async () => {
    await presenters.save(presenter('public'))
    await presenters.save(presenter('draft', false))
    await presenters.save(presenter('french', true, 'fr'))
    await programmes.save(programme('public'))
    await programmes.save(programme('draft', false))

    expect((await presenters.listPublished('en')).map((item) => item.id)).toEqual(['public'])
    expect((await programmes.listPublished('en')).map((item) => item.id)).toEqual(['public'])
  })

  it('lists upcoming airings chronologically and applies the limit', async () => {
    const from = new Date('2026-09-01T08:00:00Z')
    await schedule.save(airing('later', new Date('2026-09-01T12:00:00Z'), 'scheduled'))
    await schedule.save(airing('next', new Date('2026-09-01T10:00:00Z'), 'scheduled'))
    await schedule.save(airing('past', new Date('2026-08-30T10:00:00Z'), 'scheduled'))

    expect((await schedule.listUpcoming('en', from, 1)).map((item) => item.id)).toEqual(['next'])
  })

  it('lists only replay-ready completed airings newest first', async () => {
    await schedule.save(airing('old', new Date('2026-08-29T10:00:00Z'), 'completed'))
    await schedule.save(airing('new', new Date('2026-08-30T10:00:00Z'), 'completed'))
    await schedule.save(airing('future', new Date('2026-09-01T10:00:00Z'), 'scheduled'))

    expect((await schedule.listReplays('en', 10)).map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('enforces locale-scoped unique programme slugs', async () => {
    await programmes.save(programme('first'))
    await expect(mongo.db.collection<ProgrammeDocument>(PROGRAMMES).insertOne({
      ...programme('second').snapshot(), _id: 'second', slug: 'first', presenterIds: ['ama'],
    })).rejects.toThrow(/duplicate key/i)
  })
})
