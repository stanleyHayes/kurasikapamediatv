import { IllegalTransition, NotOwnArticle, NotPermitted, articleId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { aStranger, aSubscriber, anAuthor, anEditor, harness } from '../testing/harness'
import { ArticleNotFound } from './errors'
import { SubmitForReview } from './submit-for-review'

const target = articleId('art_1')

describe('SubmitForReview', () => {
  it('moves the stored draft into review', async () => {
    const h = harness({ articles: [anArticle()] })
    const result = await new SubmitForReview(h).execute({ actor: anAuthor, articleId: target })

    expect(result.status).toBe('in_review')
    expect((await h.articles.findById(target))?.status).toBe('in_review')
  })

  it('announces the submission', async () => {
    const h = harness({ articles: [anArticle()] })
    await new SubmitForReview(h).execute({ actor: anAuthor, articleId: target })
    expect(h.events.names()).toEqual(['article.submitted'])
  })

  it('reports an unknown article rather than failing obscurely', async () => {
    const h = harness()
    await expect(
      new SubmitForReview(h).execute({ actor: anAuthor, articleId: articleId('art_missing') }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('lets an editor submit any draft', async () => {
    const h = harness({ articles: [anArticle()] })
    const result = await new SubmitForReview(h).execute({ actor: anEditor, articleId: target })
    expect(result.status).toBe('in_review')
  })

  it('refuses to resubmit something already published', async () => {
    const h = harness({ articles: [anArticle({ status: 'published' })] })

    await expect(
      new SubmitForReview(h).execute({ actor: anAuthor, articleId: target }),
    ).rejects.toThrow(IllegalTransition)
  })
})

describe('SubmitForReview — refusals leave no trace', () => {
  it('leaves the article untouched when the actor lacks permission', async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new SubmitForReview(h).execute({ actor: aSubscriber, articleId: target }),
    ).rejects.toThrow(NotPermitted)

    expect((await h.articles.findById(target))?.status).toBe('draft')
    expect(h.events.published).toHaveLength(0)
  })

  it("refuses a different author's draft and saves nothing", async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new SubmitForReview(h).execute({ actor: aStranger, articleId: target }),
    ).rejects.toThrow(NotOwnArticle)

    expect((await h.articles.findById(target))?.status).toBe('draft')
    expect(h.events.published).toHaveLength(0)
  })
})
