import type { RateLimitRule, RateLimiter } from '@kurasikapa/application'
import { describe, expect, it } from 'vitest'
import { enforceLiveActionPolicy } from './action-policy'

class CountingLimiter implements RateLimiter {
  calls = 0
  constructor(private readonly allowed: boolean) {}
  consume(_key: string, _rule: RateLimitRule): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
    this.calls += 1
    return Promise.resolve({ allowed: this.allowed, remaining: 0, retryAfterSeconds: 30 })
  }
}

describe('live Server Action policy', () => {
  it('rate limits channel provisioning', async () => {
    const limiter = new CountingLimiter(false)
    await expect(enforceLiveActionPolicy('start', limiter, 'usr_1')).rejects.toThrow(/30/u)
    expect(limiter.calls).toBe(1)
  })

  it('never lets the limiter block channel cleanup', async () => {
    const limiter = new CountingLimiter(false)
    await expect(enforceLiveActionPolicy('end', limiter, 'usr_1')).resolves.toBeUndefined()
    expect(limiter.calls).toBe(0)
  })
})
