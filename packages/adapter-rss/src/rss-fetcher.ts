import type { RssFeedPort, RssPullResult } from '@kurasikapa/application'
import type { RssSource } from '@kurasikapa/domain'
import { parseRss } from './parse-rss'

export interface RssFetcherConfig {
  readonly get: typeof fetch
}

export class RssFetcher implements RssFeedPort {
  constructor(private readonly config: RssFetcherConfig) {}

  async pull(source: RssSource): Promise<RssPullResult> {
    const headers: Record<string, string> = {
      Accept: 'application/rss+xml, application/xml, text/xml',
    }
    if (source.etag !== null && source.etag !== '') headers['If-None-Match'] = source.etag

    const response = await this.config.get(source.url, { headers })
    if (response.status === 304) return { entries: [], etag: source.etag }
    if (!response.ok) throw new Error(`RSS ${String(response.status)}`)

    const xml = await response.text()
    return {
      entries: parseRss(xml),
      etag: response.headers.get('etag'),
    }
  }
}
