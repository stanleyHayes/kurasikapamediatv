import { Actor, CannotRecordUnpublished, articleId, userId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeClock } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryReadingRepository } from '../testing/in-memory-reading-repository'
import { CountReadings } from './count-readings'
import { ListReadingHistory } from './list-reading-history'
import { RecordReading } from './record-reading'

const NOW = new Date('2026-08-11T10:00:00Z')
const READER = new Actor(userId('usr_reader'), ['subscriber'])
const OTHER = new Actor(userId('usr_other'), ['subscriber'])
const target = articleId('art_1')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const wiring = (
  articles = [published()],
): {
  readonly readings: InMemoryReadingRepository
  readonly record: RecordReading
  readonly list: ListReadingHistory
  readonly count: CountReadings
} => {
  const readings = new InMemoryReadingRepository()
  const store = new InMemoryArticleRepository(articles)
  return {
    readings,
    record: new RecordReading({ readings, articles: store, clock: new FakeClock(NOW) }),
    list: new ListReadingHistory(readings, store),
    count: new CountReadings(readings),
  }
}

describe('RecordReading', () => {
  it('stores a visit to a published article', async () => {
    const { record, list } = wiring()

    await record.execute({ actor: READER, articleId: target })

    const page = await list.execute({ actor: READER })
    expect(page.items.map((row) => row.article.id)).toEqual([target])
  })

  it('refuses an unpublished article', async () => {
    const { record } = wiring([anArticle()])

    await expect(record.execute({ actor: READER, articleId: target })).rejects.toThrow(
      CannotRecordUnpublished,
    )
  })

  it('reports a missing article', async () => {
    const { record } = wiring([])

    await expect(record.execute({ actor: READER, articleId: target })).rejects.toThrow(
      ArticleNotFound,
    )
  })

  it('does not leak one reader’s history to another', async () => {
    const { record, list } = wiring()
    await record.execute({ actor: READER, articleId: target })

    expect((await list.execute({ actor: OTHER })).items).toHaveLength(0)
  })

  it('counts only this reader’s visits', async () => {
    const { record, count } = wiring()
    await record.execute({ actor: READER, articleId: target })
    await record.execute({ actor: OTHER, articleId: target })

    expect(await count.execute({ actor: READER })).toEqual({ count: 1 })
  })
})
