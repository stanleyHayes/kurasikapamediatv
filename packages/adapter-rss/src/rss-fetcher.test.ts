import { RssSource, categoryId } from '@kurasikapa/domain'
import { describe, expect, it, vi } from 'vitest'
import { parseRss } from './parse-rss'
import { RssFetcher } from './rss-fetcher'

const source = RssSource.register({
  id: 'rss_1',
  url: 'https://wire.example/feed.xml',
  locale: 'en',
  categoryId: categoryId('cat_wire'),
})

const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><title>Budget 2026</title><guid>g1</guid><description><![CDATA[<p>Body</p>]]></description></item>
<item><title></title><guid>skip</guid></item>
</channel></rss>`

describe('parseRss', () => {
  it('reads RSS items and skips empty titles', () => {
    const entries = parseRss(xml)

    expect(entries).toHaveLength(1)
    expect(entries[0]?.guid).toBe('g1')
    expect(entries[0]?.title).toBe('Budget 2026')
    expect(entries[0]?.body).toBe('Body')
  })

  it('reads an Atom entry and a link href', () => {
    const atom = `<feed>
<entry><title>Atom piece</title><id>a1</id><summary>Hi</summary></entry>
<entry><title>Linked</title><link href="https://wire.example/x"/></entry>
</feed>`
    const entries = parseRss(atom)

    expect(entries[0]).toEqual({ guid: 'a1', title: 'Atom piece', body: 'Hi' })
    expect(entries[1]?.guid).toBe('https://wire.example/x')
  })
})

describe('RssFetcher', () => {
  it('parses a 200 body and keeps etag', async () => {
    const get = vi.fn().mockResolvedValue(
      new Response(xml, { status: 200, headers: { etag: '"v1"' } }),
    )
    const result = await new RssFetcher({ get }).pull(source)

    expect(result.entries).toHaveLength(1)
    expect(result.etag).toBe('"v1"')
  })

  it('returns no items on 304', async () => {
    const tagged = source.fetched('"v1"', new Date('2026-08-11T19:00:00Z'))
    const get = vi.fn().mockResolvedValue(new Response(null, { status: 304 }))
    const result = await new RssFetcher({ get }).pull(tagged)

    expect(result.entries).toEqual([])
    expect(result.etag).toBe('"v1"')
  })

  it('refuses a non-OK feed', async () => {
    const get = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(new RssFetcher({ get }).pull(source)).rejects.toThrow(/500/u)
  })
})
