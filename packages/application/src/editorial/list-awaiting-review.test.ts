import { NotPermitted, articleId, familyId, userId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { aJournalist, aStranger, anAuthor, anEditor } from '../testing/harness'
import { ListAwaitingReview } from './list-awaiting-review'

const queue = (): InMemoryArticleRepository =>
  new InMemoryArticleRepository([
    anArticle({ status: 'in_review' }),
    anArticle({
      id: articleId('art_2'),
      familyId: familyId('fam_2'),
      authorId: userId('usr_stranger'),
      status: 'in_review',
    }),
    anArticle({ id: articleId('art_3'), familyId: familyId('fam_3'), status: 'draft' }),
  ])

describe('ListAwaitingReview', () => {
  it('returns submissions from every author, not just the editor’s own', async () => {
    // The whole point of a review queue. "My drafts" is the other use case.
    const page = await new ListAwaitingReview({ articles: queue() }).execute({ actor: anEditor })

    expect(page.items.map((a) => a.id).sort()).toEqual(['art_1', 'art_2'])
  })

  it('excludes anything not awaiting a decision', async () => {
    const page = await new ListAwaitingReview({ articles: queue() }).execute({ actor: anEditor })

    expect(page.items.map((a) => a.id)).not.toContain('art_3')
  })

  it('refuses a journalist', async () => {
    // The permission check is the only thing between a journalist and every
    // colleague's unpublished submission.
    await expect(
      new ListAwaitingReview({ articles: queue() }).execute({ actor: aJournalist }),
    ).rejects.toThrow(NotPermitted)
  })

  it('refuses an author', async () => {
    await expect(
      new ListAwaitingReview({ articles: queue() }).execute({ actor: anAuthor }),
    ).rejects.toThrow(NotPermitted)
  })

  it('refuses before reading anything', async () => {
    const articles = queue()
    let reads = 0
    const original = articles.listAwaitingReview.bind(articles)
    articles.listAwaitingReview = (c): ReturnType<typeof original> => {
      reads += 1
      return original(c)
    }

    await expect(new ListAwaitingReview({ articles }).execute({ actor: aStranger })).rejects.toThrow(
      NotPermitted,
    )
    expect(reads).toBe(0)
  })

  it.each([
    ['an absent', undefined, 25],
    ['a zero', 0, 25],
    ['an absurd', 9999, 100],
  ])('maps %s limit to %i', async (_label, requested, expected) => {
    const articles = new InMemoryArticleRepository()
    const seen: number[] = []
    const original = articles.listAwaitingReview.bind(articles)
    articles.listAwaitingReview = (c): ReturnType<typeof original> => {
      seen.push(c.limit)
      return original(c)
    }

    await new ListAwaitingReview({ articles }).execute({ actor: anEditor, limit: requested })

    expect(seen).toEqual([expected])
  })
})
