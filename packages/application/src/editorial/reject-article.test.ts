import { IllegalTransition, NotPermitted, articleId, revisionId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { aJournalist, anEditor, harness } from '../testing/harness'
import { ArticleNotFound } from './errors'
import { RejectArticle } from './reject-article'

const target = articleId('art_1')
const note = 'Second source needed for the ministry quote.'

const inReview = (): ReturnType<typeof anArticle> =>
  anArticle({ status: 'in_review', approvedRevisionId: revisionId('rev_1') })

describe('RejectArticle', () => {
  it('returns the article to draft', async () => {
    const h = harness({ articles: [inReview()] })
    const result = await new RejectArticle(h).execute({ actor: anEditor, articleId: target, note })

    expect(result.status).toBe('draft')
  })

  it('clears any prior approval, so a stale revision cannot publish later', async () => {
    const h = harness({ articles: [inReview()] })
    await new RejectArticle(h).execute({ actor: anEditor, articleId: target, note })

    expect((await h.articles.findById(target))?.snapshot().approvedRevisionId).toBeNull()
  })

  it("carries the editor's note on the event for the author notification", async () => {
    const h = harness({ articles: [inReview()] })
    await new RejectArticle(h).execute({ actor: anEditor, articleId: target, note })

    expect(h.events.last()).toMatchObject({ name: 'article.rejected', note })
  })

  it('reports an unknown article', async () => {
    const h = harness()
    await expect(
      new RejectArticle(h).execute({ actor: anEditor, articleId: articleId('art_missing'), note }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('refuses a journalist', async () => {
    const h = harness({ articles: [inReview()] })
    await expect(
      new RejectArticle(h).execute({ actor: aJournalist, articleId: target, note }),
    ).rejects.toThrow(NotPermitted)
  })

  it('refuses to reject a draft that was never submitted', async () => {
    const h = harness({ articles: [anArticle()] })
    await expect(
      new RejectArticle(h).execute({ actor: anEditor, articleId: target, note }),
    ).rejects.toThrow(IllegalTransition)
  })
})
