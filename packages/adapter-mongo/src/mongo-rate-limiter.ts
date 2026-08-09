import type {
  ClockPort,
  RateLimitRule,
  RateLimitVerdict,
  RateLimiter,
} from '@kurasikapa/application'
import type { Collection, Db } from 'mongodb'
import { RATE_LIMITS, type RateLimitDocument } from './documents'

/**
 * Rate limiting on MongoDB.
 *
 * Mongo rather than Redis or Vercel KV because it is already here. A limiter
 * needs shared state across instances and a TTL; the cluster provides both,
 * and adding a vendor for a counter means another credential, another bill and
 * another thing to be down.
 *
 * The cost is a write per limited request. Against an Anthropic call that is
 * noise, and the endpoints worth limiting are the expensive ones.
 *
 * FIXED window, not sliding. A sliding log stores every timestamp and a
 * sliding counter needs two windows and interpolation; a fixed window lets
 * roughly 2x through at a boundary and is otherwise correct. For "stop a
 * script burning the AI budget" that is the right trade. If this ever guards
 * something where the 2x matters, it needs replacing, not tuning.
 */
export class MongoRateLimiter implements RateLimiter {
  private readonly counters: Collection<RateLimitDocument>

  /**
   * The clock is injected, like everywhere else. A windowed counter is
   * precisely the thing whose behaviour at a boundary must be testable
   * without waiting for a real minute to pass.
   */
  constructor(
    private readonly db: Db,
    private readonly clock: ClockPort,
  ) {
    this.counters = db.collection<RateLimitDocument>(RATE_LIMITS)
  }

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitVerdict> {
    const now = this.clock.now().getTime()
    const windowMs = rule.windowSeconds * 1000

    // The window id is part of the document key, so a new window is a new
    // document rather than a read-modify-write of the old one. Nothing has to
    // reset a counter, and two requests either side of a boundary cannot race
    // over which one clears it.
    const windowStart = Math.floor(now / windowMs) * windowMs
    const id = `${key}:${String(windowStart)}`
    const expiresAt = new Date(windowStart + windowMs)

    // One atomic upsert. $inc on a missing document creates it at 1, so there
    // is no check-then-set gap for concurrent requests to slip through — which
    // is the failure mode a limiter exists to prevent, and the one an
    // in-process counter has by construction.
    const updated = await this.counters.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: 'after' },
    )

    const count = updated?.count ?? 1

    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      // At least one second: a caller told to retry after zero retries
      // immediately, which is the burst the limit just refused.
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
    }
  }

  /**
   * The TTL index that stops this collection growing without bound.
   *
   * Mongo's TTL monitor runs about once a minute, so documents outlive their
   * window slightly. That is harmless: the window id already makes an expired
   * document unreachable, and the index is housekeeping rather than
   * correctness.
   */
  async ensureIndexes(): Promise<void> {
    await this.db
      .collection(RATE_LIMITS)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_ttl' })
  }
}
