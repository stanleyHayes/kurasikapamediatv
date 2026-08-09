import {
  IllegalTransition,
  MissingApprovedRevision,
  NotPermitted,
  articleId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { LATER, NOW, anAuthor, anEditor, harness } from '../testing/harness'
import { ArticleNotFound } from './errors'
import { PublishDueArticles } from './publish-due-articles'
import { PublishArticle } from './publish-article'

const target = articleId('art_1')

describe('PublishArticle', () => {
  it('publishes an approved article', async () => {
    const h = harness({ articles: [anApprovedArticle()] })
    const result = await new PublishArticle(h).execute({ actor: anEditor, articleId: target })

    expect(result.status).toBe('published')
    expect(result.publishedAt).toEqual(NOW)
  })

  it('returns the slug and locale the caller needs to invalidate the cache', async () => {
    const h = harness({ articles: [anApprovedArticle()] })
    const result = await new PublishArticle(h).execute({ actor: anEditor, articleId: target })

    expect(result.slug).toBe('budget-2026')
    expect(result.locale).toBe('en')
  })

  it('carries slug and locale on the event, so no second read is needed', async () => {
    // Breaking news must be live within the publishing request. A subscriber
    // that had to re-fetch the article to know its tag would add a round trip.
    const h = harness({ articles: [anApprovedArticle()] })
    await new PublishArticle(h).execute({ actor: anEditor, articleId: target })

    expect(h.events.last()).toMatchObject({
      name: 'article.published',
      slug: 'budget-2026',
      locale: 'en',
    })
  })

  it('clears the schedule when publishing something scheduled', async () => {
    const h = harness({
      articles: [anApprovedArticle({ status: 'scheduled', scheduledAt: LATER })],
    })
    await new PublishArticle(h).execute({ actor: anEditor, articleId: target })

    expect((await h.articles.findById(target))?.scheduledAt).toBeNull()
  })

  it('refuses to publish without an approved revision', async () => {
    const h = harness({ articles: [anArticle({ status: 'approved' })] })

    await expect(
      new PublishArticle(h).execute({ actor: anEditor, articleId: target }),
    ).rejects.toThrow(MissingApprovedRevision)

    expect(h.events.published).toHaveLength(0)
  })

  it('refuses to publish straight from draft', async () => {
    const h = harness({ articles: [anApprovedArticle({ status: 'draft' })] })

    await expect(
      new PublishArticle(h).execute({ actor: anEditor, articleId: target }),
    ).rejects.toThrow(IllegalTransition)
  })

  it('refuses an author', async () => {
    const h = harness({ articles: [anApprovedArticle()] })

    await expect(
      new PublishArticle(h).execute({ actor: anAuthor, articleId: target }),
    ).rejects.toThrow(NotPermitted)
  })

  it('reports an unknown article', async () => {
    const h = harness()
    await expect(
      new PublishArticle(h).execute({ actor: anEditor, articleId: articleId('art_missing') }),
    ).rejects.toThrow(ArticleNotFound)
  })
})

describe('a failing announcement does not fail a completed publish', () => {
  it('still reports success, and the article stays published', async () => {
    // The bug this guards was found by the scheduled-publication cron. The
    // article saved fine; a cache subscriber then threw, the error propagated,
    // and the cron marked a live article as failed. Next minute it retried,
    // the domain refused published → published, and it failed again — an
    // alert that never clears, about an article that was never broken.
    const h = harness({ articles: [anApprovedArticle()] })
    h.events.publish = (): Promise<void> => Promise.reject(new Error('cache subscriber exploded'))

    const result = await new PublishArticle(h).execute({ actor: anEditor, articleId: target })

    expect(result.status).toBe('published')

    const saved = await h.articles.findById(target)
    expect(saved?.status).toBe('published')
  })

  it('also holds for the scheduled path, which is where it bites hardest', async () => {
    const h = harness({ articles: [anApprovedArticle({ status: 'scheduled', scheduledAt: NOW })] })
    h.events.publish = (): Promise<void> => Promise.reject(new Error('cache subscriber exploded'))

    const result = await new PublishDueArticles(h).execute({ actor: anEditor })

    expect(result.published).toEqual([target])
    expect(result.failed).toEqual([])
  })
})
