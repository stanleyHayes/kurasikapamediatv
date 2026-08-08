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

export interface LimitBounds {
  readonly fallback: number
  readonly max: number
}

/**
 * `limit` reaches use cases from a query string. Unclamped, one request could
 * ask for every article ever published; unvalidated, a fractional or negative
 * value reaches the driver.
 *
 * Shared rather than repeated, so a bound cannot be tightened in one list and
 * forgotten in another.
 */
export function clampLimit(requested: number | undefined, bounds: LimitBounds): number {
  if (requested === undefined) return bounds.fallback
  if (!Number.isInteger(requested) || requested < 1) return bounds.fallback

  return Math.min(requested, bounds.max)
}
