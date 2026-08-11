import { describe, expect, it } from 'vitest'
import { categoryId } from '../shared/ids'
import { InvalidRssUrl, RssSource } from './rss-source'

const NOW = new Date('2026-08-11T19:00:00Z')
const draft = {
  id: 'rss_1',
  url: 'https://wire.example/feed.xml',
  locale: 'en',
  categoryId: categoryId('cat_wire'),
}

describe('RssSource.register', () => {
  it('stores an https feed and starts unseen', () => {
    const source = RssSource.register(draft)

    expect(source.url).toBe(draft.url)
    expect(source.locale).toBe('en')
    expect(source.seen('item-1')).toBe(false)
    expect(RssSource.reconstitute(source.snapshot()).id).toBe('rss_1')
  })

  it('refuses a non-https URL', () => {
    expect(() => RssSource.register({ ...draft, url: 'http://insecure/feed' })).toThrow(
      InvalidRssUrl,
    )
    expect(() => RssSource.register({ ...draft, url: 'not-a-url' })).toThrow(InvalidRssUrl)
    expect(() => RssSource.register({ ...draft, locale: 'x' })).toThrow(InvalidRssUrl)
  })
})

describe('RssSource.remember', () => {
  it('records a guid once and stamps a fetch', () => {
    const source = RssSource.register(draft).remember('item-1').fetched('"abc"', NOW)

    expect(source.seen('item-1')).toBe(true)
    expect(source.remember('item-1').snapshot().seenGuids).toHaveLength(1)
    expect(source.etag).toBe('"abc"')
    expect(source.snapshot().lastFetchedAt).toEqual(NOW)
  })
})
