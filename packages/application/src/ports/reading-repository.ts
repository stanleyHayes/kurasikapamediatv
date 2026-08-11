import type { Reading, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

/**
 * Every method takes the reader whose history it is.
 *
 * There is deliberately no `findById`: what someone read is among the most
 * sensitive data this platform holds, and an id-addressable row would be a
 * shape of request that reads someone else's list.
 */
export interface ReadingRepository {
  listFor(readerId: UserId, cursor: Cursor): Promise<Page<Reading>>
  save(reading: Reading): Promise<void>
  countFor(readerId: UserId): Promise<number>
}
