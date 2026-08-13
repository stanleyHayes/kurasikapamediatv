import type { RateLimiter, RateLimitVerdict } from '@kurasikapa/application'
import { describe, expect, it, vi } from 'vitest'
import { RateLimited, RULES, limit } from './rate-limit'

class FakeLimiter implements RateLimiter {
  public lastKey: string | undefined
  public lastRule: { limit: number; windowSeconds: number } | undefined

  constructor(private readonly verdict: RateLimitVerdict | Error) {}

  consume(
    key: string,
    rule: { limit: number; windowSeconds: number },
  ): Promise<RateLimitVerdict> {
    this.lastKey = key
    this.lastRule = rule
    if (this.verdict instanceof Error) return Promise.reject(this.verdict)
    return Promise.resolve(this.verdict)
  }
}

describe('limit', () => {
  it('allows when the limiter allows', async () => {
    const limiter = new FakeLimiter({ allowed: true, remaining: 19, retryAfterSeconds: 0 })

    const verdict = await limit(limiter, 'actor:usr_1', 'ai', 'closed')

    expect(verdict).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(limiter.lastKey).toBe('ai:actor:usr_1')
    expect(limiter.lastRule).toEqual(RULES.ai)
  })

  it('denies with the retry window the limiter reports', async () => {
    const limiter = new FakeLimiter({ allowed: false, remaining: 0, retryAfterSeconds: 42 })

    const verdict = await limit(limiter, 'ip:203.0.113.9', 'comments', 'closed')

    expect(verdict).toEqual({ allowed: false, retryAfterSeconds: 42 })
    expect(limiter.lastKey).toBe('comments:ip:203.0.113.9')
    expect(limiter.lastRule).toEqual(RULES.comments)
  })

  it('fails open when the limiter is down and the rule allows it', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const limiter = new FakeLimiter(new Error('mongo down'))

    const verdict = await limit(limiter, 'actor:usr_1', 'search', 'open')

    expect(verdict).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('fails closed with the scope window when the limiter is down', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const limiter = new FakeLimiter(new Error('mongo down'))

    const verdict = await limit(limiter, 'actor:usr_1', 'breaking', 'closed')

    expect(verdict).toEqual({
      allowed: false,
      retryAfterSeconds: RULES.breaking.windowSeconds,
    })
    errorSpy.mockRestore()
  })
})

describe('RateLimited', () => {
  it('tells the caller how long to wait', () => {
    expect(new RateLimited(40).message).toBe('Too many requests. Try again in 40 seconds.')
    expect(new RateLimited(40).retryAfterSeconds).toBe(40)
  })
})
