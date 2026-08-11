import { describe, expect, it } from 'vitest'
import { rssXml } from './rss'

const article = {
  id: 'art_1',
  slug: 'hello',
  locale: 'en',
  title: 'Fish & chips',
  categoryId: 'cat_1',
  publishedAt: '2026-08-11T09:00:00.000Z',
}

describe('rssXml', () => {
  it('escapes titles so a headline cannot break the feed', () => {
    const xml = rssXml({
      title: 'Kurasikapa',
      home: 'https://example.com',
      builtAt: new Date('2026-08-11T10:00:00.000Z'),
      items: [article],
    })

    expect(xml).toContain('Fish &amp; chips')
    expect(xml).not.toContain('Fish & chips')
    expect(xml).toContain('https://example.com/en/articles/hello')
    expect(xml).toContain('<pubDate>Tue, 11 Aug 2026 09:00:00 GMT</pubDate>')
  })

  it('omits pubDate when the article has no publish time rather than inventing one', () => {
    const xml = rssXml({
      title: 'Kurasikapa',
      home: 'https://example.com/',
      builtAt: new Date('2026-08-11T10:00:00.000Z'),
      items: [{ ...article, publishedAt: null }],
    })

    expect(xml).not.toContain('<pubDate>')
  })
})
