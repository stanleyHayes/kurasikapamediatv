import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { RATE_LIMITS } from './documents'
import { MongoRateLimiter } from './mongo-rate-limiter'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness

/** A clock the test moves by hand — a window boundary is the interesting case. */
class MovableClock {
  constructor(private at: Date) {}
  now(): Date {
    return this.at
  }
  advance(seconds: number): void {
    this.at = new Date(this.at.getTime() + seconds * 1000)
  }
}

const RULE = { limit: 3, windowSeconds: 60 }

beforeAll(async () => {
  mongo = await startMongo()
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

describe('MongoRateLimiter', () => {
  it('allows up to the limit and refuses the next', async () => {
    const limiter = new MongoRateLimiter(mongo.db, new MovableClock(new Date('2026-08-09T12:00:00Z')))

    const verdicts = []
    for (let i = 0; i < 4; i++) verdicts.push(await limiter.consume('k', RULE))

    expect(verdicts.map((v) => v.allowed)).toEqual([true, true, true, false])
    expect(verdicts.map((v) => v.remaining)).toEqual([2, 1, 0, 0])
  })

  it('counts concurrent calls without letting them all through', async () => {
    // The failure mode a limiter exists to prevent, and the one an in-process
    // counter or a check-then-increment has by construction. Ten at once
    // against a limit of three must yield exactly three.
    const limiter = new MongoRateLimiter(mongo.db, new MovableClock(new Date('2026-08-09T12:00:00Z')))

    const verdicts = await Promise.all(
      Array.from({ length: 10 }, () => limiter.consume('k', RULE)),
    )

    expect(verdicts.filter((v) => v.allowed)).toHaveLength(3)
  })

  it('keeps separate keys separate', async () => {
    const limiter = new MongoRateLimiter(mongo.db, new MovableClock(new Date('2026-08-09T12:00:00Z')))

    for (let i = 0; i < 3; i++) await limiter.consume('a', RULE)

    expect((await limiter.consume('a', RULE)).allowed).toBe(false)
    expect((await limiter.consume('b', RULE)).allowed).toBe(true)
  })

  it('opens a fresh allowance in the next window', async () => {
    const clock = new MovableClock(new Date('2026-08-09T12:00:00Z'))
    const limiter = new MongoRateLimiter(mongo.db, clock)

    for (let i = 0; i < 3; i++) await limiter.consume('k', RULE)
    expect((await limiter.consume('k', RULE)).allowed).toBe(false)

    clock.advance(60)

    expect((await limiter.consume('k', RULE)).allowed).toBe(true)
  })

  it('reports a wait a caller can act on', async () => {
    // Zero would tell a caller to retry immediately, which is the burst just
    // refused.
    const clock = new MovableClock(new Date('2026-08-09T12:00:30Z'))
    const limiter = new MongoRateLimiter(mongo.db, clock)

    for (let i = 0; i < 3; i++) await limiter.consume('k', RULE)
    const refused = await limiter.consume('k', RULE)

    expect(refused.retryAfterSeconds).toBeGreaterThan(0)
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(RULE.windowSeconds)
  })

  it('does not let an old window leak into a new one', async () => {
    // A new window is a new document rather than a reset of the old one, so
    // nothing has to clear a counter and two requests either side of a
    // boundary cannot race over which one does.
    const clock = new MovableClock(new Date('2026-08-09T12:00:00Z'))
    const limiter = new MongoRateLimiter(mongo.db, clock)

    await limiter.consume('k', RULE)
    clock.advance(120)

    const fresh = await limiter.consume('k', RULE)
    expect(fresh.remaining).toBe(RULE.limit - 1)
  })

  it('the counter collection is bounded by a TTL index', async () => {
    // Created by ensureIndexes, which the harness runs. A collection of
    // counters without expiry grows without bound.
    const names = (await mongo.db.collection(RATE_LIMITS).indexes()).map((i) => i.name)

    expect(names).toContain('rate_limit_ttl')
  })
})
