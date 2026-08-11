import { describe, expect, it } from 'vitest'
import type { ArticleView } from './article-view'
import { homeRails, trendingRail } from './home-rails'

const story = (id: string): ArticleView => ({
  id,
  slug: id,
  locale: 'en',
  title: id,
  categoryId: 'cat_news',
  publishedAt: '2026-08-11T10:00:00.000Z',
})

describe('trendingRail', () => {
  it('prefers most-read stories that are not already on the page', () => {
    const ranked = [story('hot'), story('lead'), story('warm')]
    const recency = [story('old')]
    const occupied = new Set(['lead'])

    expect(trendingRail(ranked, recency, occupied).map((row) => row.id)).toEqual([
      'hot',
      'warm',
      'old',
    ])
  })

  it('falls back to recency when nobody has been read yet', () => {
    const recency = [story('a'), story('b'), story('c')]

    expect(trendingRail([], recency, new Set()).map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('homeRails', () => {
  it('keeps most-read out of the hero and briefing', () => {
    const items = ['lead', 'b1', 'b2', 'b3', 'b4', 'r1'].map(story)
    const rails = homeRails(items, [story('lead'), story('hot'), story('b1')])

    expect(rails.lead?.id).toBe('lead')
    expect(rails.briefing.map((row) => row.id)).toEqual(['b1', 'b2', 'b3', 'b4'])
    expect(rails.trending.map((row) => row.id)).toEqual(['hot', 'r1'])
  })
})
