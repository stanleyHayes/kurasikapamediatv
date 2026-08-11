import type { ArticleId, Reading, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

export interface ArticleReadRank {
  readonly articleId: ArticleId
  readonly readers: number
}

/**
 * Per-reader methods take the reader whose history it is.
 *
 * There is deliberately no `findById`: what someone read is among the most
 * sensitive data this platform holds, and an id-addressable row would be a
 * shape of request that reads someone else's list.
 *
 * `rankByReaders` is the public aggregate: unique readers per article, no
 * identities. That is a different question than "what did this person read".
 */
export interface ReadingRepository {
  listFor(readerId: UserId, cursor: Cursor): Promise<Page<Reading>>
  save(reading: Reading): Promise<void>
  countFor(readerId: UserId): Promise<number>
  rankByReaders(limit: number): Promise<readonly ArticleReadRank[]>
}
