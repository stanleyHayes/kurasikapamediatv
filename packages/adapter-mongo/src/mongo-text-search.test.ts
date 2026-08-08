import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoArticleRepository } from './mongo-article-repository'
import { MongoTextSearch } from './mongo-text-search'
import { article, fixedClock, published } from './testing/fixtures'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoArticleRepository
let search: MongoTextSearch

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoArticleRepository({ db: mongo.db, clock: fixedClock() })
  search = new MongoTextSearch(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const at = (iso: string): Date => new Date(iso)
const WHEN = at('2026-08-05T00:00:00Z')

describe('search', () => {
  it('finds an article by a word in its headline', async () => {
    await repo.save(published('art_1', WHEN, { title: 'Budget 2026 Explained', slug: 'budget' }))

    const page = await search.search({ terms: 'budget', locale: 'en', limit: 10 })

    expect(page.items.map((h) => h.articleId)).toEqual(['art_1'])
  })

  it('stems, so a plural query finds the singular', async () => {
    await repo.save(published('art_1', WHEN, { title: 'Election Result', slug: 'election' }))

    const page = await search.search({ terms: 'elections', locale: 'en', limit: 10 })

    expect(page.items).toHaveLength(1)
  })

  it('returns the score the ordering is based on', async () => {
    await repo.save(published('art_1', WHEN, { title: 'Budget', slug: 'budget' }))

    const page = await search.search({ terms: 'budget', locale: 'en', limit: 10 })

    expect(page.items[0]?.score).toBeGreaterThan(0)
  })
})

describe('search — what readers must never see', () => {
  it('excludes unpublished drafts', async () => {
    // Searching for a headline must not be a way to read a draft.
    await repo.save(published('live', WHEN, { title: 'Budget Live', slug: 'live' }))
    await repo.save(article({ id: 'secret', title: 'Budget Secret', slug: 'secret' }))

    const page = await search.search({ terms: 'budget', locale: 'en', limit: 10 })

    expect(page.items.map((h) => h.articleId)).toEqual(['live'])
  })

  it('does not cross locales', async () => {
    await repo.save(published('en_1', WHEN, { title: 'Budget', slug: 'budget-en', locale: 'en' }))
    await repo.save(
      published('fr_1', WHEN, { title: 'Budget', slug: 'budget-fr', locale: 'fr', familyId: 'fam_fr' }),
    )

    const page = await search.search({ terms: 'budget', locale: 'fr', limit: 10 })

    expect(page.items.map((h) => h.articleId)).toEqual(['fr_1'])
  })

  it('returns nothing rather than everything when no article matches', async () => {
    await repo.save(published('art_1', WHEN, { title: 'Budget', slug: 'budget' }))

    const page = await search.search({ terms: 'zzzznonexistent', locale: 'en', limit: 10 })

    expect(page.items).toEqual([])
    expect(page.nextCursor).toBeNull()
  })
})

describe('search — pagination', () => {
  it('hands out a cursor only when more results exist', async () => {
    for (let i = 0; i < 4; i++) {
      await repo.save(
        published(`art_${String(i)}`, WHEN, { title: `Budget part ${String(i)}`, slug: `budget-${String(i)}` }),
      )
    }

    const first = await search.search({ terms: 'budget', locale: 'en', limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()

    const all = await search.search({ terms: 'budget', locale: 'en', limit: 10 })
    expect(all.nextCursor).toBeNull()
  })
})
