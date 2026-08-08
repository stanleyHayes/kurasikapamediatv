/**
 * Cursor pagination, never offset.
 *
 * A news archive grows at the head, so `skip(n)` both degrades as the archive
 * grows and silently shifts results when something publishes mid-scroll.
 */
export interface Cursor {
  /**
   * Explicitly `| undefined` rather than a bare optional. Callers hold the
   * previous page's `nextCursor`, which is `string | null`; under
   * exactOptionalPropertyTypes a bare optional would reject the natural
   * `after: prev.nextCursor ?? undefined` at every call site.
   */
  readonly after?: string | undefined
  readonly limit: number
}

export interface Page<T> {
  readonly items: readonly T[]
  readonly nextCursor: string | null
}
