import { Reading, articleId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoReadingRepository } from './mongo-reading-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoReadingRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoReadingRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const row = (reader: string, article: string, at: string): Reading =>
  Reading.reconstitute({
    readerId: userId(reader),
    articleId: articleId(article),
    locale: 'en',
    readAt: new Date(at),
  })

describe('MongoReadingRepository', () => {
  it('upserts the latest visit', async () => {
    await repo.save(row('usr_1', 'art_1', '2026-08-11T10:00:00Z'))
    await repo.save(row('usr_1', 'art_1', '2026-08-11T12:00:00Z'))

    expect(await repo.countFor(userId('usr_1'))).toBe(1)
    const page = await repo.listFor(userId('usr_1'), { limit: 10 })
    expect(page.items[0]?.readAt.toISOString()).toBe('2026-08-11T12:00:00.000Z')
  })

  it('lists only this reader, newest first', async () => {
    await repo.save(row('usr_1', 'art_old', '2026-08-11T09:00:00Z'))
    await repo.save(row('usr_1', 'art_new', '2026-08-11T11:00:00Z'))
    await repo.save(row('usr_2', 'art_other', '2026-08-11T12:00:00Z'))

    const page = await repo.listFor(userId('usr_1'), { limit: 10 })
    expect(page.items.map((r) => r.articleId)).toEqual(['art_new', 'art_old'])
  })

  it('pages newest first', async () => {
    await repo.save(row('usr_1', 'art_a', '2026-08-11T10:00:00Z'))
    await repo.save(row('usr_1', 'art_b', '2026-08-11T11:00:00Z'))
    await repo.save(row('usr_1', 'art_c', '2026-08-11T12:00:00Z'))

    const first = await repo.listFor(userId('usr_1'), { limit: 2 })
    expect(first.items.map((r) => r.articleId)).toEqual(['art_c', 'art_b'])
    expect(first.nextCursor).toBeTruthy()

    const next = await repo.listFor(userId('usr_1'), {
      limit: 2,
      after: first.nextCursor ?? undefined,
    })
    expect(next.items.map((r) => r.articleId)).toEqual(['art_a'])
    expect(next.nextCursor).toBeNull()
  })
})
