import { articleId, familyId, userId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryRevisionRepository } from '../testing/in-memory-revision-repository'
import { aStranger, anAuthor } from '../testing/harness'
import { ListAuthoredArticles } from './list-authored-articles'

const repo = (): InMemoryArticleRepository =>
  new InMemoryArticleRepository([
    anArticle(),
    anArticle({
      id: articleId('art_2'),
      familyId: familyId('fam_2'),
      authorId: userId('usr_stranger'),
    }),
  ])

describe('ListAuthoredArticles', () => {
  it("returns only the actor's own articles", async () => {
    const page = await new ListAuthoredArticles({ articles: repo(), revisions: new InMemoryRevisionRepository() }).execute({ actor: anAuthor })

    expect(page.items.map((a) => a.article.id)).toEqual(['art_1'])
  })

  it('scopes to the actor, never to a caller-supplied id', async () => {
    // A userId parameter here would let any journalist read a colleague's
    // unpublished work by editing a query string.
    const page = await new ListAuthoredArticles({ articles: repo(), revisions: new InMemoryRevisionRepository() }).execute({ actor: aStranger })

    expect(page.items.map((a) => a.article.id)).toEqual(['art_2'])
  })

  it.each([
    ['an absent', undefined, 25],
    ['a zero', 0, 25],
    ['a fractional', 2.5, 25],
    ['a reasonable', 10, 10],
    ['an absurd', 5000, 100],
  ])('maps %s limit to %i', async (_label, requested, expected) => {
    const articles = new InMemoryArticleRepository()
    const seen: number[] = []
    const original = articles.listAuthoredBy.bind(articles)
    articles.listAuthoredBy = (q): ReturnType<typeof original> => {
      seen.push(q.limit)
      return original(q)
    }

    await new ListAuthoredArticles({
      articles,
      revisions: new InMemoryRevisionRepository(),
    }).execute({ actor: anAuthor, limit: requested })

    expect(seen).toEqual([expected])
  })
})
