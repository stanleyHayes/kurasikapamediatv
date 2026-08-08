import { describe, expect, it } from 'vitest'
import type { SearchHit } from '../ports/search'
import { FakeSearch } from '../testing/fake-search'
import { SearchArticles } from './search-articles'

const hit: SearchHit = {
  articleId: 'art_1',
  slug: 'budget-2026',
  title: 'Budget 2026',
  locale: 'en',
  publishedAt: '2026-08-08T10:00:00.000Z',
  score: 4.2,
}

describe('SearchArticles', () => {
  it('returns hits from the index', async () => {
    const search = new FakeSearch([hit])

    const page = await new SearchArticles({ search }).execute({ terms: 'budget', locale: 'en' })

    expect(page.items).toEqual([hit])
  })

  it('trims the query before sending it', async () => {
    const search = new FakeSearch()

    await new SearchArticles({ search }).execute({ terms: '  budget  ', locale: 'en' })

    expect(search.queries[0]?.terms).toBe('budget')
  })

  it('passes the locale through, so results never cross languages', async () => {
    const search = new FakeSearch()

    await new SearchArticles({ search }).execute({ terms: 'budget', locale: 'fr' })

    expect(search.queries[0]?.locale).toBe('fr')
  })
})

describe('SearchArticles — queries not worth running', () => {
  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['a single character', 'a'],
    ['a single character with padding', '  b  '],
  ])('returns nothing for %s without touching the index', async (_label, terms) => {
    // "Everything" is both a useless answer and an expensive one on a news
    // archive, and an empty box submitted by accident should not scan it.
    const search = new FakeSearch([hit])

    const page = await new SearchArticles({ search }).execute({ terms, locale: 'en' })

    expect(page).toEqual({ items: [], nextCursor: null })
    expect(search.queries).toHaveLength(0)
  })

  it('accepts a two-character query, which real ones are', async () => {
    const search = new FakeSearch([hit])

    const page = await new SearchArticles({ search }).execute({ terms: 'AI', locale: 'en' })

    expect(page.items).toHaveLength(1)
  })
})

describe('SearchArticles — limit clamping', () => {
  it.each([
    ['an absent', undefined, 20],
    ['a zero', 0, 20],
    ['an absurd', 10_000, 50],
  ])('maps %s limit to %i', async (_label, requested, expected) => {
    const search = new FakeSearch()

    await new SearchArticles({ search }).execute({ terms: 'budget', locale: 'en', limit: requested })

    expect(search.queries[0]?.limit).toBe(expected)
  })
})
