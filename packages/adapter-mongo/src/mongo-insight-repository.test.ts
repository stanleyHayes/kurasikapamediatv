import { ArticleEngagement, PageView, articleId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ARTICLES, CATEGORIES, LEGACY_USERS, NEWSLETTER_SUBSCRIBERS } from './documents'
import { MongoInsightRepository } from './mongo-insight-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoInsightRepository
interface FixtureDocument { _id: string; [key: string]: unknown }

beforeAll(async () => { mongo = await startMongo(); repo = new MongoInsightRepository(mongo.db) })
afterEach(async () => { await mongo.reset() })
afterAll(async () => { await mongo.stop() })

const view = (id: string, visitor: string, channel: 'direct' | 'search', input: { at: string; article?: string }): PageView => PageView.record({
  id, articleId: articleId(input.article ?? 'article-1'), locale: 'en', visitorHash: visitor.repeat(64), channel, occurredAt: new Date(input.at),
})

const engagement = (id: string, visitor: string, depth: 25 | 50 | 75 | 100, seconds: number): ArticleEngagement => ArticleEngagement.record({
  id, articleId: articleId('article-1'), locale: 'en', visitorHash: visitor.repeat(64),
  scrollDepth: depth, activeSeconds: seconds, occurredAt: new Date('2026-08-31T12:00:00Z'),
})

describe('MongoInsightRepository', () => {
  it('appends privacy-safe views and builds newsroom aggregates', async () => {
    await mongo.db.collection<FixtureDocument>(ARTICLES).insertMany([
      { _id: 'article-1', familyId: 'family-1', locale: 'en', slug: 'lead-story', title: 'Lead story', categoryId: 'news', authorId: 'author-1', tagIds: [], status: 'published', approvedRevisionId: 'rev-1', scheduledAt: null, publishedAt: new Date('2026-08-29T10:00:00Z'), updatedAt: new Date('2026-08-29T10:00:00Z') },
      { _id: 'article-2', familyId: 'family-2', locale: 'en', slug: 'second-story', title: 'Second story', categoryId: 'culture', authorId: 'author-2', tagIds: [], status: 'published', approvedRevisionId: 'rev-2', scheduledAt: null, publishedAt: new Date('2026-08-29T11:00:00Z'), updatedAt: new Date('2026-08-29T11:00:00Z') },
    ])
    await mongo.db.collection<FixtureDocument>(CATEGORIES).insertMany([{ _id: 'news', slugs: { en: 'news', fr: 'actualites' }, names: { en: 'News' } }, { _id: 'culture', slugs: { en: 'culture', fr: 'culture' }, names: { en: 'Culture' } }])
    await mongo.db.collection<FixtureDocument>(LEGACY_USERS).insertMany([{ _id: 'author-1', email: 'ama@example.com', name: 'Ama Mensah' }, { _id: 'author-2', email: 'kojo@example.com', name: 'Kojo Owusu' }])
    await mongo.db.collection<FixtureDocument>(NEWSLETTER_SUBSCRIBERS).insertMany([
      { _id: 'sub-1', email: 'reader@example.com', state: 'confirmed', confirmedAt: new Date('2026-08-30T10:00:00Z') },
      { _id: 'sub-2', email: 'pending@example.com', state: 'pending', confirmedAt: null },
    ])
    await repo.append(view('v1', 'a', 'search', { at: '2026-08-30T10:00:00Z' }))
    await repo.append(view('v2', 'a', 'direct', { at: '2026-08-31T10:00:00Z' }))
    await repo.append(view('v3', 'b', 'search', { at: '2026-08-31T11:00:00Z', article: 'article-2' }))
    await repo.appendEngagement(engagement('e1', 'a', 25, 10))
    await repo.appendEngagement(engagement('e2', 'a', 50, 20))
    await repo.appendEngagement(engagement('e3', 'a', 75, 30))
    await repo.appendEngagement(engagement('e4', 'b', 25, 14))

    const report = await repo.report(31, new Date('2026-09-01T00:00:00Z'))
    expect(report).toMatchObject({ views: 3, uniqueReaders: 2, returningReaders: 1, newsletterSubscribers: 1, newsletterGrowth: 1, searchViews: 2 })
    expect(report.traffic).toHaveLength(2)
    expect(report.topStories[0]).toMatchObject({ label: 'Lead story', value: 2 })
    expect(report.topCategories[0]).toMatchObject({ label: 'News', value: 2 })
    expect(report.topAuthors[0]).toMatchObject({ label: 'Ama Mensah', value: 2 })
    expect(report.averageActiveSeconds).toBe(22)
    expect(report.readingDepth).toEqual([
      { depth: 25, readers: 2, retention: 100 },
      { depth: 50, readers: 1, retention: 50 },
      { depth: 75, readers: 1, retention: 50 },
      { depth: 100, readers: 0, retention: 0 },
    ])
  })
})
