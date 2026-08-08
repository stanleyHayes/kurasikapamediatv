import { NotOwnArticle, NotPermitted, Revision, articleId, revisionId, userId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { NOW, aStranger, aSubscriber, anAuthor, anEditor, harness } from '../testing/harness'
import { ArticleNotFound } from './errors'
import { GetDraft } from './get-draft'

const target = articleId('art_1')

const revision = (body: string, seq: number): Revision =>
  Revision.reconstitute({
    id: revisionId(`rev_${String(seq)}`),
    articleId: target,
    seq,
    title: 'Budget 2026',
    body,
    authorId: userId('usr_author'),
    createdAt: NOW,
  })

describe('GetDraft', () => {
  it('returns the article with its newest text', async () => {
    const h = harness({
      articles: [anArticle()],
      revisions: [revision('first', 1), revision('second', 2)],
    })

    const result = await new GetDraft(h).execute({ actor: anAuthor, articleId: target })

    expect(result.article.id).toBe('art_1')
    expect(result.latest?.body).toBe('second')
  })

  it('returns a null revision for an article with no text yet', async () => {
    const h = harness({ articles: [anArticle()] })

    expect((await new GetDraft(h).execute({ actor: anAuthor, articleId: target })).latest).toBeNull()
  })

  it('reports an unknown article', async () => {
    const h = harness()

    await expect(
      new GetDraft(h).execute({ actor: anAuthor, articleId: target }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('lets an editor open anyone’s draft', async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new GetDraft(h).execute({ actor: anEditor, articleId: target }),
    ).resolves.toBeDefined()
  })

  it('opens a published article for reading, though editing it is refused', async () => {
    const h = harness({ articles: [anApprovedArticle({ status: 'published', publishedAt: NOW })] })

    await expect(
      new GetDraft(h).execute({ actor: anEditor, articleId: target }),
    ).resolves.toBeDefined()
  })
})

describe('GetDraft — confidentiality', () => {
  it("refuses another author's unpublished draft", async () => {
    // "It is only a GET" is how internal leaks happen. An unpublished draft is
    // confidential until the newsroom decides otherwise.
    const h = harness({ articles: [anArticle()] })

    await expect(
      new GetDraft(h).execute({ actor: aStranger, articleId: target }),
    ).rejects.toThrow(NotOwnArticle)
  })

  it('refuses a subscriber outright', async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new GetDraft(h).execute({ actor: aSubscriber, articleId: target }),
    ).rejects.toThrow(NotPermitted)
  })
})
