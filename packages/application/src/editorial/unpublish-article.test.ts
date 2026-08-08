import { IllegalTransition, NotPermitted, articleId, revisionId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { NOW, aJournalist, anEditor, harness } from '../testing/harness.js'
import { ArticleNotFound } from './errors.js'
import { PublishArticle } from './publish-article.js'
import { UnpublishArticle } from './unpublish-article.js'

const target = articleId('art_1')
const reason = 'Ministry disputed the figure; pulled pending correction.'

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

describe('UnpublishArticle', () => {
  it('pulls a published article', async () => {
    const h = harness({ articles: [published()] })
    const result = await new UnpublishArticle(h).execute({
      actor: anEditor,
      articleId: target,
      reason,
    })

    expect(result.status).toBe('unpublished')
  })

  it('retains the reason on the event for the audit log', async () => {
    const h = harness({ articles: [published()] })
    await new UnpublishArticle(h).execute({ actor: anEditor, articleId: target, reason })

    expect(h.events.last()).toMatchObject({ name: 'article.unpublished', reason })
  })

  it('keeps the approved revision, so a correction can republish without re-review', async () => {
    const h = harness({ articles: [published()] })
    await new UnpublishArticle(h).execute({ actor: anEditor, articleId: target, reason })

    const pulled = await h.articles.findById(target)
    expect(pulled?.snapshot().approvedRevisionId).toBe(revisionId('rev_1'))
  })

  it('can be republished straight away', async () => {
    const h = harness({ articles: [published()] })
    await new UnpublishArticle(h).execute({ actor: anEditor, articleId: target, reason })
    const result = await new PublishArticle(h).execute({ actor: anEditor, articleId: target })

    expect(result.status).toBe('published')
  })

  it('refuses a journalist', async () => {
    const h = harness({ articles: [published()] })

    await expect(
      new UnpublishArticle(h).execute({ actor: aJournalist, articleId: target, reason }),
    ).rejects.toThrow(NotPermitted)
  })

  it('refuses to unpublish a draft', async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new UnpublishArticle(h).execute({ actor: anEditor, articleId: target, reason }),
    ).rejects.toThrow(IllegalTransition)
  })

  it('reports an unknown article', async () => {
    const h = harness()

    await expect(
      new UnpublishArticle(h).execute({
        actor: anEditor,
        articleId: articleId('art_missing'),
        reason,
      }),
    ).rejects.toThrow(ArticleNotFound)
  })
})
