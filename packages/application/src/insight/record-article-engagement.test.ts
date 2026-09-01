import { describe, expect, it } from 'vitest'
import { Article, Slug, articleId, categoryId, familyId, revisionId, userId } from '@kurasikapa/domain'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryInsightRepository } from '../testing/in-memory-insight-repository'
import { RecordArticleEngagement } from './record-article-engagement'

const published = Article.reconstitute({
  id: articleId('article-1'), familyId: familyId('family-1'), locale: 'en', slug: Slug.of('story'), title: 'Story',
  authorId: userId('author-1'), categoryId: categoryId('news'), tagIds: [], status: 'published',
  approvedRevisionId: revisionId('revision-1'), scheduledAt: null, publishedAt: new Date('2026-08-30T12:00:00Z'),
})

describe('RecordArticleEngagement', () => {
  it('records engagement only for a published article in the requested locale', async () => {
    const insights = new InMemoryInsightRepository()
    const useCase = new RecordArticleEngagement({
      articles: new InMemoryArticleRepository([published]), insights,
      clock: { now: () => new Date('2026-09-01T12:00:00Z') }, ids: { next: () => 'engagement-1' },
    })
    await useCase.execute({ articleId: published.id, locale: 'en', visitorHash: 'a'.repeat(64), scrollDepth: 75, activeSeconds: 42 })
    expect(insights.engagements[0]?.snapshot()).toMatchObject({ scrollDepth: 75, activeSeconds: 42 })
    await expect(useCase.execute({ articleId: published.id, locale: 'fr', visitorHash: 'a'.repeat(64), scrollDepth: 50, activeSeconds: 4 })).rejects.toThrow('not published')
  })
})
