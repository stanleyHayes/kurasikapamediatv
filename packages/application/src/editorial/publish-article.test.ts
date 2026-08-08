import {
  IllegalTransition,
  MissingApprovedRevision,
  NotPermitted,
  articleId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { LATER, NOW, anAuthor, anEditor, harness } from '../testing/harness.js'
import { ArticleNotFound } from './errors.js'
import { PublishArticle } from './publish-article.js'

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
