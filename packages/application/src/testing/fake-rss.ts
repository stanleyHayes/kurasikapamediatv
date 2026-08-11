import type { RssSource } from '@kurasikapa/domain'
import type { RssEntry, RssFeedPort, RssPullResult } from '../ports/rss-feed'

export class RecordingRssFeed implements RssFeedPort {
  readonly pulled: string[] = []

  constructor(private readonly result: RssPullResult) {}

  pull(source: RssSource): Promise<RssPullResult> {
    this.pulled.push(source.url)
    return Promise.resolve(this.result)
  }
}

export class FailClosedRssFeed implements RssFeedPort {
  pull(): Promise<RssPullResult> {
    return Promise.reject(new Error('RSS fetch failed'))
  }
}

export const anEntry = (guid: string, title = 'Wire: budget'): RssEntry => ({
  guid,
  title,
  body: `${title} body`,
})
