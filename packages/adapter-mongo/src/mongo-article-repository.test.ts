import { articleId, revisionId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ARTICLES, type ArticleDocument } from './documents.js'
import { MongoArticleRepository } from './mongo-article-repository.js'
import { AUTHOR, BUSINESS, NOW, SPORTS, article, fixedClock, published } from './testing/fixtures.js'
import { type MongoHarness, startMongo } from './testing/mongo-harness.js'

let mongo: MongoHarness
let repo: MongoArticleRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoArticleRepository({ db: mongo.db, clock: fixedClock() })
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const at = (iso: string): Date => new Date(iso)

describe('round trip', () => {
  it('preserves every field through save and findById', async () => {
    const original = article({
      id: 'art_full',
      locale: 'fr',
      slug: 'budget-2026-fr',
      title: 'Le Budget',
      status: 'scheduled',
      scheduledAt: at('2026-09-01T08:00:00Z'),
      approvedRevisionId: null,
    })
    await repo.save(original)

    const loaded = await repo.findById(articleId('art_full'))

    expect(loaded?.snapshot()).toEqual(original.snapshot())
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(articleId('art_missing'))).toBeNull()
  })

  it('preserves an approved revision id, which gates publication', async () => {
    await repo.save(
      article({ id: 'art_ok', status: 'approved', approvedRevisionId: revisionId('rev_7') }),
    )

    const loaded = await repo.findById(articleId('art_ok'))

    expect(loaded?.snapshot().approvedRevisionId).toBe('rev_7')
  })

  it('updates in place rather than inserting a duplicate', async () => {
    await repo.save(article({ id: 'art_1' }))
    await repo.save(article({ id: 'art_1', status: 'in_review' }))

    expect((await repo.findById(articleId('art_1')))?.status).toBe('in_review')
    expect(await mongo.db.collection('articles').countDocuments()).toBe(1)
  })
})

describe('findBySlug', () => {
  it('finds by slug within a locale', async () => {
    await repo.save(article({ id: 'art_1', slug: 'budget-2026', locale: 'en' }))
    expect((await repo.findBySlug('budget-2026', 'en'))?.id).toBe('art_1')
  })

  it('does not cross locales', async () => {
    await repo.save(article({ id: 'art_1', slug: 'budget-2026', locale: 'en' }))
    expect(await repo.findBySlug('budget-2026', 'fr')).toBeNull()
  })
})

describe('uniqueness the domain cannot enforce', () => {
  it('rejects a second article with the same slug in the same locale', async () => {
    await repo.save(article({ id: 'art_1', slug: 'budget-2026', locale: 'en' }))

    await expect(
      repo.save(article({ id: 'art_2', slug: 'budget-2026', locale: 'en' })),
    ).rejects.toThrow(/duplicate key/iu)
  })

  it('allows the same slug in a different locale', async () => {
    await repo.save(article({ id: 'art_1', slug: 'budget-2026', locale: 'en' }))
    await repo.save(article({ id: 'art_2', slug: 'budget-2026', locale: 'fr' }))

    expect(await mongo.db.collection('articles').countDocuments()).toBe(2)
  })

  it('rejects two versions of the same family in one locale', async () => {
    await repo.save(article({ id: 'art_1', familyId: 'fam_x', locale: 'en', slug: 'a' }))

    await expect(
      repo.save(article({ id: 'art_2', familyId: 'fam_x', locale: 'en', slug: 'b' })),
    ).rejects.toThrow(/duplicate key/iu)
  })
})

describe('listDueForPublication', () => {
  it('returns only scheduled articles whose moment has passed', async () => {
    await repo.save(article({ id: 'due', status: 'scheduled', scheduledAt: at('2026-08-08T09:00:00Z') }))
    await repo.save(article({ id: 'later', status: 'scheduled', scheduledAt: at('2026-08-08T11:00:00Z') }))
    await repo.save(article({ id: 'draft' }))

    const due = await repo.listDueForPublication(NOW)

    expect(due.map((a) => a.id)).toEqual(['due'])
  })

  it('includes an article scheduled for exactly now', async () => {
    await repo.save(article({ id: 'exact', status: 'scheduled', scheduledAt: NOW }))
    expect(await repo.listDueForPublication(NOW)).toHaveLength(1)
  })
})

describe('listAuthoredBy', () => {
  it('returns only that author, newest first', async () => {
    const mine = new MongoArticleRepository({ db: mongo.db, clock: fixedClock(at('2026-08-01T00:00:00Z')) })
    await mine.save(article({ id: 'old', authorId: AUTHOR }))

    const later = new MongoArticleRepository({ db: mongo.db, clock: fixedClock(at('2026-08-05T00:00:00Z')) })
    await later.save(article({ id: 'new', authorId: AUTHOR }))
    await later.save(article({ id: 'theirs', authorId: userId('usr_other') }))

    const page = await mine.listAuthoredBy({ authorId: AUTHOR, limit: 10 })

    expect(page.items.map((a) => a.id)).toEqual(['new', 'old'])
  })
})

describe('listPublished', () => {
  const seed = async (): Promise<void> => {
    await repo.save(published('art_a', at('2026-08-05T00:00:00Z')))
    await repo.save(published('art_b', at('2026-08-04T00:00:00Z')))
    await repo.save(published('art_c', at('2026-08-03T00:00:00Z')))
    await repo.save(article({ id: 'art_draft' }))
    await repo.save(published('art_fr', at('2026-08-06T00:00:00Z'), { locale: 'fr', familyId: 'fam_fr' }))
  }

  it('returns published articles for one locale, newest first', async () => {
    await seed()
    const page = await repo.listPublished({ locale: 'en', limit: 10 })

    expect(page.items.map((a) => a.id)).toEqual(['art_a', 'art_b', 'art_c'])
    expect(page.nextCursor).toBeNull()
  })

  it('excludes drafts', async () => {
    await seed()
    const page = await repo.listPublished({ locale: 'en', limit: 10 })
    expect(page.items.map((a) => a.id)).not.toContain('art_draft')
  })

  it('filters by category', async () => {
    await repo.save(published('art_biz', at('2026-08-05T00:00:00Z'), { categoryId: BUSINESS }))
    await repo.save(published('art_spo', at('2026-08-04T00:00:00Z'), { categoryId: SPORTS }))

    const page = await repo.listPublished({ locale: 'en', limit: 10, categoryId: SPORTS })

    expect(page.items.map((a) => a.id)).toEqual(['art_spo'])
  })
})

describe('keyset pagination', () => {
  const seedTen = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) {
      const day = String(20 - i).padStart(2, '0')
      await repo.save(published(`art_${String(i).padStart(2, '0')}`, at(`2026-08-${day}T00:00:00Z`)))
    }
  }

  it('walks the whole archive without a gap or a repeat', async () => {
    await seedTen()
    const seen: string[] = []
    let cursor: string | undefined

    for (let guard = 0; guard < 10; guard++) {
      const page: Awaited<ReturnType<typeof repo.listPublished>> = await repo.listPublished(
        cursor === undefined ? { locale: 'en', limit: 3 } : { locale: 'en', limit: 3, after: cursor },
      )
      seen.push(...page.items.map((a) => a.id))
      if (page.nextCursor === null) break
      cursor = page.nextCursor
    }

    expect(seen).toHaveLength(10)
    expect(new Set(seen).size).toBe(10)
  })

  it('does not shift the reader when a newer article publishes mid-scroll', async () => {
    // The failure offset paging has: a new article at the head pushes
    // everything down one, so page 2 repeats the last item of page 1.
    await seedTen()
    const first = await repo.listPublished({ locale: 'en', limit: 3 })

    await repo.save(published('art_breaking', at('2026-08-21T00:00:00Z')))

    const second = await repo.listPublished({
      locale: 'en',
      limit: 3,
      after: first.nextCursor ?? undefined,
    })

    expect(second.items.map((a) => a.id)).not.toContain(first.items.at(-1)?.id)
  })

  it('separates ties on publishedAt by id, so the order is total', async () => {
    const same = at('2026-08-05T00:00:00Z')
    await repo.save(published('art_x', same))
    await repo.save(published('art_y', same))
    await repo.save(published('art_z', same))

    const first = await repo.listPublished({ locale: 'en', limit: 2 })
    const second = await repo.listPublished({
      locale: 'en',
      limit: 2,
      after: first.nextCursor ?? undefined,
    })

    expect([...first.items, ...second.items].map((a) => a.id)).toEqual(['art_z', 'art_y', 'art_x'])
  })

  it('hands out no cursor for a zero limit', async () => {
    // Degenerate, but a caller computing `limit` from user input can reach it,
    // and returning a cursor for an empty page would strand the scroll.
    await seedTen()
    const page = await repo.listPublished({ locale: 'en', limit: 0 })

    expect(page.items).toHaveLength(0)
    expect(page.nextCursor).toBeNull()
  })

  it('ends the scroll when the cursor article has been unpublished', async () => {
    // Restarting from the top instead would turn infinite scroll into a loop.
    await seedTen()
    const first = await repo.listPublished({ locale: 'en', limit: 3 })
    const anchor = first.nextCursor
    if (anchor === null) throw new Error('expected a cursor after the first page')

    await mongo.db.collection<ArticleDocument>(ARTICLES).deleteOne({ _id: anchor })

    const second = await repo.listPublished({ locale: 'en', limit: 3, after: anchor })

    expect(second.items).toHaveLength(0)
    expect(second.nextCursor).toBeNull()
  })
})
