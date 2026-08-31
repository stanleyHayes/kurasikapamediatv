import { describe, expect, it } from 'vitest'
import { buildNewsSitemap, recentNewsItems, type NewsSitemapItem } from './news-sitemap'

const NOW = new Date('2026-08-31T12:00:00.000Z')

describe('recentNewsItems', () => {
  it('keeps only published stories from the rolling two-day window', () => {
    expect(recentNewsItems([
      item('fresh', '2026-08-31T10:00:00.000Z'),
      item('boundary', '2026-08-29T12:00:00.000Z'),
      item('old', '2026-08-29T11:59:59.999Z'),
      item('missing', null),
    ], NOW).map((entry) => entry.slug)).toEqual(['fresh', 'boundary'])
  })
})

describe('buildNewsSitemap', () => {
  it('writes Google News metadata and escapes editorial text', () => {
    const xml = buildNewsSitemap([{ ...item('markets', '2026-08-31T10:00:00.000Z'), title: 'Oil & cocoa < outlook' }], 'https://news.example')

    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"')
    expect(xml).toContain('<loc>https://news.example/en/articles/markets</loc>')
    expect(xml).toContain('<news:language>en</news:language>')
    expect(xml).toContain('<news:title>Oil &amp; cocoa &lt; outlook</news:title>')
  })
})

function item(slug: string, publishedAt: string | null): NewsSitemapItem {
  return { locale: 'en', slug, title: slug, publishedAt }
}
