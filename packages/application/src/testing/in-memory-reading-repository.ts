import type { Reading, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from '../ports/pagination'
import type { ReadingRepository } from '../ports/reading-repository'

const key = (reader: string, article: string): string => `${reader}:${article}`

export class InMemoryReadingRepository implements ReadingRepository {
  private readonly rows = new Map<string, Reading>()

  listFor(readerId: UserId, cursor: Cursor): Promise<Page<Reading>> {
    const sorted = [...this.rows.values()]
      .filter((row) => row.readerId === readerId)
      .sort((a, b) => b.readAt.getTime() - a.readAt.getTime())
    const start =
      cursor.after === undefined ? 0 : sorted.findIndex((r) => r.articleId === cursor.after) + 1
    const slice = sorted.slice(Math.max(0, start), Math.max(0, start) + cursor.limit)
    const more = start + cursor.limit < sorted.length

    return Promise.resolve({
      items: slice,
      nextCursor: more ? (slice.at(-1)?.articleId ?? null) : null,
    })
  }

  save(reading: Reading): Promise<void> {
    this.rows.set(key(reading.readerId, reading.articleId), reading)
    return Promise.resolve()
  }

  countFor(readerId: UserId): Promise<number> {
    return Promise.resolve([...this.rows.values()].filter((row) => row.readerId === readerId).length)
  }
}
