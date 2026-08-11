import {
  Actor,
  CannotRecordUnpublished,
  Reading,
  Slug,
  articleId,
  userId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeClock } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryReadingRepository } from '../testing/in-memory-reading-repository'
import { CountReadings } from './count-readings'
import { ListMostRead } from './list-most-read'
import { ListReadingHistory } from './list-reading-history'
import { RecordReading } from './record-reading'

const NOW = new Date('2026-08-11T10:00:00Z')
const READER = new Actor(userId('usr_reader'), ['subscriber'])
const OTHER = new Actor(userId('usr_other'), ['subscriber'])
const target = articleId('art_1')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const live = (id: string, locale = 'en'): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({
    id: articleId(id),
    locale,
    slug: Slug.of(id.replaceAll('_', '-')),
    status: 'published',
    publishedAt: NOW,
  })

const wiring = (
  articles = [published()],
): {
  readonly readings: InMemoryReadingRepository
  readonly record: RecordReading
  readonly list: ListReadingHistory
  readonly count: CountReadings
  readonly mostRead: ListMostRead
} => {
  const readings = new InMemoryReadingRepository()
  const store = new InMemoryArticleRepository(articles)
  return {
    readings,
    record: new RecordReading({ readings, articles: store, clock: new FakeClock(NOW) }),
    list: new ListReadingHistory(readings, store),
    count: new CountReadings(readings),
    mostRead: new ListMostRead(readings, store),
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

describe('ListMostRead', () => {
  it('ranks published articles by unique readers in this locale', async () => {
    const hot = live('art_hot')
    const cold = live('art_cold')
    const { record, mostRead } = wiring([hot, cold])

    await record.execute({ actor: READER, articleId: hot.id })
    await record.execute({ actor: OTHER, articleId: hot.id })
    await record.execute({ actor: READER, articleId: cold.id })

    const ranked = await mostRead.execute({ locale: 'en', limit: 2 })
    expect(ranked.map((article) => article.id)).toEqual([hot.id, cold.id])
  })

  it('drops unpublished and other-locale ranks', async () => {
    const hot = live('art_hot')
    const french = live('art_fr', 'fr')
    const draft = anArticle({ id: articleId('art_draft'), slug: Slug.of('draft-story') })
    const { readings, mostRead } = wiring([hot, french, draft])

    await readings.save(
      Reading.reconstitute({
        readerId: READER.id,
        articleId: draft.id,
        locale: 'en',
        readAt: NOW,
      }),
    )
    await readings.save(
      Reading.reconstitute({
        readerId: OTHER.id,
        articleId: draft.id,
        locale: 'en',
        readAt: NOW,
      }),
    )
    await readings.save(
      Reading.reconstitute({
        readerId: READER.id,
        articleId: french.id,
        locale: 'fr',
        readAt: NOW,
      }),
    )
    await readings.save(
      Reading.reconstitute({
        readerId: READER.id,
        articleId: hot.id,
        locale: 'en',
        readAt: NOW,
      }),
    )

    expect((await mostRead.execute({ locale: 'en' })).map((article) => article.id)).toEqual([
      hot.id,
    ])
  })
})
