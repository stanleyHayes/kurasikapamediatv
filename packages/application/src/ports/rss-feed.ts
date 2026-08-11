import type { RssSource } from '@kurasikapa/domain'

export interface RssEntry {
  readonly guid: string
  readonly title: string
  readonly body: string
}

export interface RssPullResult {
  readonly entries: readonly RssEntry[]
  readonly etag: string | null
}

/**
 * Pulls a feed. Network and parse failures throw — the use case skips that
 * source rather than inventing items.
 */
export interface RssFeedPort {
  pull(source: RssSource): Promise<RssPullResult>
}
