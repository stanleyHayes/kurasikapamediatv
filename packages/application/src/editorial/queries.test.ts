import { ARTICLE_STATUSES, type Article, articleId, categoryId, familyId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import type { PublishedQuery } from '../ports/article-repository'
import type { Page } from '../ports/pagination'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { GetPublishedArticle } from './get-published-article'
import { ListPublishedArticles } from './list-published-articles'

const NOW = new Date('2026-08-08T10:00:00Z')

const repoWith = (...articles: Article[]): InMemoryArticleRepository =>
  new InMemoryArticleRepository(articles)

describe('GetPublishedArticle', () => {
  it('returns a published article', async () => {
    const articles = repoWith(anArticle({ status: 'published', publishedAt: NOW }))

    const found = await new GetPublishedArticle({ articles }).execute({
      slug: 'budget-2026',
      locale: 'en',
    })

    expect(found?.id).toBe('art_1')
  })

  it('returns null when nothing matches', async () => {
    const found = await new GetPublishedArticle({ articles: repoWith() }).execute({
      slug: 'nope',
      locale: 'en',
    })

    expect(found).toBeNull()
  })

  it('does not cross locales', async () => {
    const articles = repoWith(anArticle({ status: 'published', publishedAt: NOW }))

    const found = await new GetPublishedArticle({ articles }).execute({
      slug: 'budget-2026',
      locale: 'fr',
    })

    expect(found).toBeNull()
  })

  it.each(ARTICLE_STATUSES.filter((s) => s !== 'published'))(
    'hides an article in state "%s" from readers',
    async (status) => {
      // Not merely a repository filter. A query edited carelessly would serve
      // an unpublished draft to the public, so the domain decides visibility
      // and it is tested without a database.
      const articles = repoWith(anArticle({ status }))

      const found = await new GetPublishedArticle({ articles }).execute({
        slug: 'budget-2026',
        locale: 'en',
      })

      expect(found).toBeNull()
    },
  )
})

describe('ListPublishedArticles', () => {
  const seeded = (): InMemoryArticleRepository =>
    repoWith(
      anArticle({ status: 'published', publishedAt: NOW }),
      anArticle({ id: articleId('art_2'), familyId: familyId('fam_2'), status: 'draft' }),
    )

  it('returns published articles only', async () => {
    const page = await new ListPublishedArticles({ articles: seeded() }).execute({ locale: 'en' })
    expect(page.items.map((a) => a.id)).toEqual(['art_1'])
  })

  it('filters by category', async () => {
    const page = await new ListPublishedArticles({ articles: seeded() }).execute({
      locale: 'en',
      categoryId: categoryId('cat_sports'),
    })

    expect(page.items).toHaveLength(0)
  })

  it('passes the cursor through unchanged', async () => {
    const { articles, seen } = capturingRepo()

    await new ListPublishedArticles({ articles }).execute({ locale: 'en', after: 'art_9' })

    expect(seen[0]?.after).toBe('art_9')
  })
})

describe('ListPublishedArticles — limit clamping', () => {
  it.each([
    ['an absent', undefined, 12],
    ['a zero', 0, 12],
    ['a negative', -5, 12],
    ['a fractional', 3.7, 12],
    ['a reasonable', 20, 20],
    ['an absurd', 100_000, 50],
  ])('maps %s limit to %i', async (_label, requested, expected) => {
    // `limit` arrives from a query string. Unclamped, one request could ask
    // for every article ever published.
    const { articles, seen } = capturingRepo()

    await new ListPublishedArticles({ articles }).execute({ locale: 'en', limit: requested })

    expect(seen[0]?.limit).toBe(expected)
  })
})

/** Records the query the use case actually issued. */
function capturingRepo(): { articles: InMemoryArticleRepository; seen: PublishedQuery[] } {
  const articles = new InMemoryArticleRepository()
  const seen: PublishedQuery[] = []
  const original = articles.listPublished.bind(articles)

  articles.listPublished = (query: PublishedQuery): Promise<Page<Article>> => {
    seen.push(query)
    return original(query)
  }

  return { articles, seen }
}
