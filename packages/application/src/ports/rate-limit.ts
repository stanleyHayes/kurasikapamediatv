/**
 * Rate limiting.
 *
 * A port rather than a helper because the answer has to be shared across
 * instances. Vercel runs many, each with its own memory, so an in-process
 * counter limits nothing — it multiplies the real limit by however many
 * instances happen to be warm, which is a number nobody controls.
 */

export interface RateLimitRule {
  /** Requests allowed within the window. */
  readonly limit: number
  /** Window length in seconds. */
  readonly windowSeconds: number
}

export interface RateLimitVerdict {
  readonly allowed: boolean
  /** How many remain in this window. Zero once the limit is reached. */
  readonly remaining: number
  /**
   * Seconds until the window resets, for a Retry-After header.
   *
   * Seconds rather than a Date so no caller has to read a clock to work out
   * the difference — the adapter already knows when the window ends, and
   * making everyone recompute it is how a determinism rule gets an exemption
   * it did not need.
   */
  readonly retryAfterSeconds: number
}

export interface RateLimiter {
  /**
   * Counts one attempt against `key` and says whether it may proceed.
   *
   * Counts FIRST, then answers. A limiter that checks and then increments
   * gives every concurrent request the same answer, which is exactly the shape
   * of traffic a limit exists to stop.
   */
  consume(key: string, rule: RateLimitRule): Promise<RateLimitVerdict>
}
