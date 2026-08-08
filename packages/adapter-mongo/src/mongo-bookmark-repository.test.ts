import { Bookmark, articleId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoBookmarkRepository } from './mongo-bookmark-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoBookmarkRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoBookmarkRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const READER = userId('usr_reader')
const OTHER = userId('usr_other')

const bookmark = (reader: string, article: string, savedAt: string): Bookmark =>
  Bookmark.reconstitute({
    readerId: userId(reader),
    articleId: articleId(article),
    locale: 'en',
    savedAt: new Date(savedAt),
  })

describe('save and read back', () => {
  it('round trips a bookmark', async () => {
    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-05T00:00:00Z'))

    const page = await repo.listFor(READER, { limit: 10 })

    expect(page.items[0]?.articleId).toBe('art_1')
    expect(page.items[0]?.locale).toBe('en')
  })

  it('saving twice leaves one row', async () => {
    // The use case promises idempotence; this is where it is kept.
    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-05T00:00:00Z'))
    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-06T00:00:00Z'))

    expect(await mongo.db.collection('bookmarks').countDocuments()).toBe(1)
  })

  it('isSaved reflects what is stored', async () => {
    expect(await repo.isSaved(READER, articleId('art_1'))).toBe(false)

    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-05T00:00:00Z'))

    expect(await repo.isSaved(READER, articleId('art_1'))).toBe(true)
  })
})

describe('one reader never sees another', () => {
  it('lists only the reader’s own saves', async () => {
    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-05T00:00:00Z'))
    await repo.save(bookmark('usr_other', 'art_2', '2026-08-06T00:00:00Z'))

    const mine = await repo.listFor(READER, { limit: 10 })

    expect(mine.items.map((b) => b.articleId)).toEqual(['art_1'])
  })

  it('two readers may save the same article independently', async () => {
    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-05T00:00:00Z'))
    await repo.save(bookmark('usr_other', 'art_1', '2026-08-05T00:00:00Z'))

    expect(await repo.isSaved(READER, articleId('art_1'))).toBe(true)
    expect(await repo.isSaved(OTHER, articleId('art_1'))).toBe(true)
  })

  it('removing one reader’s bookmark leaves the other’s', async () => {
    await repo.save(bookmark('usr_reader', 'art_1', '2026-08-05T00:00:00Z'))
    await repo.save(bookmark('usr_other', 'art_1', '2026-08-05T00:00:00Z'))

    await repo.remove(READER, articleId('art_1'))

    expect(await repo.isSaved(READER, articleId('art_1'))).toBe(false)
    expect(await repo.isSaved(OTHER, articleId('art_1'))).toBe(true)
  })
})

describe('listing', () => {
  it('returns newest first', async () => {
    await repo.save(bookmark('usr_reader', 'art_old', '2026-08-01T00:00:00Z'))
    await repo.save(bookmark('usr_reader', 'art_new', '2026-08-07T00:00:00Z'))

    const page = await repo.listFor(READER, { limit: 10 })

    expect(page.items.map((b) => b.articleId)).toEqual(['art_new', 'art_old'])
  })

  it('hands out a cursor only when more exist', async () => {
    for (let i = 0; i < 4; i++) {
      await repo.save(bookmark('usr_reader', `art_${String(i)}`, `2026-08-0${String(i + 1)}T00:00:00Z`))
    }

    const first = await repo.listFor(READER, { limit: 2 })
    const all = await repo.listFor(READER, { limit: 10 })

    expect(first.nextCursor).not.toBeNull()
    expect(all.nextCursor).toBeNull()
  })

  it('returns an empty list for a reader with nothing saved', async () => {
    expect(await repo.listFor(READER, { limit: 10 })).toEqual({ items: [], nextCursor: null })
  })

  it('removing something never saved is not an error', async () => {
    await expect(repo.remove(READER, articleId('art_x'))).resolves.toBeUndefined()
  })
})
