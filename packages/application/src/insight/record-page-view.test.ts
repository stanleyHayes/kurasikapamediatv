import { describe, expect, it } from 'vitest'
import { Article, Slug, articleId, categoryId, familyId, revisionId, userId } from '@kurasikapa/domain'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryInsightRepository } from '../testing/in-memory-insight-repository'
import { RecordPageView } from './record-page-view'

const published = Article.reconstitute({
  id: articleId('article-1'), familyId: familyId('family-1'), locale: 'en', slug: Slug.of('story'), title: 'Story',
  authorId: userId('author-1'), categoryId: categoryId('news'), tagIds: [], status: 'published',
  approvedRevisionId: revisionId('revision-1'), scheduledAt: null, publishedAt: new Date('2026-08-30T12:00:00Z'),
})

describe('RecordPageView', () => {
  it('records a view of a published article', async () => {
    const articles = new InMemoryArticleRepository([published])
    const insights = new InMemoryInsightRepository()
    await new RecordPageView({ articles, insights, clock: { now: () => new Date('2026-08-31T12:00:00Z') }, ids: { next: () => 'view-1' } }).execute({
      articleId: published.id, locale: 'en', visitorHash: 'a'.repeat(64), channel: 'search',
    })
    expect(insights.views[0]?.snapshot()).toMatchObject({ id: 'view-1', channel: 'search' })
  })

  it('refuses a missing article or mismatched locale', async () => {
    const useCase = new RecordPageView({ articles: new InMemoryArticleRepository([published]), insights: new InMemoryInsightRepository(), clock: { now: () => new Date() }, ids: { next: () => 'view-1' } })
    await expect(useCase.execute({ articleId: articleId('missing'), locale: 'en', visitorHash: 'a'.repeat(64), channel: 'direct' })).rejects.toThrow('not published')
    await expect(useCase.execute({ articleId: published.id, locale: 'fr', visitorHash: 'a'.repeat(64), channel: 'direct' })).rejects.toThrow('not published')
  })
})
