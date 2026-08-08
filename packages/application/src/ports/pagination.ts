/**
 * Cursor pagination, never offset.
 *
 * A news archive grows at the head, so `skip(n)` both degrades as the archive
 * grows and silently shifts results when something publishes mid-scroll.
 */
export interface Cursor {
  readonly after?: string
  readonly limit: number
}

export interface Page<T> {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}
