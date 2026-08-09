import { describe, expect, it } from 'vitest'
import { isAuthorisedCron } from './cron-auth'

const SECRET = 'a'.repeat(64)

const withHeader = (value?: string): Request =>
  new Request('https://example.test/api/cron/publish-due', {
    headers: value === undefined ? {} : { authorization: value },
  })

describe('isAuthorisedCron', () => {
  it('accepts the configured secret', () => {
    expect(isAuthorisedCron(withHeader(`Bearer ${SECRET}`), SECRET)).toBe(true)
  })

  it('refuses every request when no secret is configured', () => {
    // The critical case. An endpoint that publishes articles must not fall
    // open because a variable is missing — "unconfigured" is not a reason to
    // run unprotected, it is a reason to run not at all.
    expect(isAuthorisedCron(withHeader(`Bearer ${SECRET}`), undefined)).toBe(false)
    expect(isAuthorisedCron(withHeader('Bearer '), undefined)).toBe(false)
    expect(isAuthorisedCron(withHeader(`Bearer ${SECRET}`), '')).toBe(false)
  })

  it('refuses a missing Authorization header', () => {
    expect(isAuthorisedCron(withHeader(), SECRET)).toBe(false)
  })

  it('refuses a wrong secret of the same length', () => {
    expect(isAuthorisedCron(withHeader(`Bearer ${'b'.repeat(64)}`), SECRET)).toBe(false)
  })

  it('refuses a wrong secret of a different length', () => {
    // Must not throw. timingSafeEqual raises on a length mismatch, and letting
    // that escape would turn a 404 into a 500 — which tells an attacker their
    // guess was the wrong LENGTH, a far more useful signal than wrong value.
    expect(() => isAuthorisedCron(withHeader('Bearer short'), SECRET)).not.toThrow()
    expect(isAuthorisedCron(withHeader('Bearer short'), SECRET)).toBe(false)
  })

  it('refuses the secret without the Bearer scheme', () => {
    expect(isAuthorisedCron(withHeader(SECRET), SECRET)).toBe(false)
  })

  it('refuses a scheme that merely starts the same way', () => {
    expect(isAuthorisedCron(withHeader(`BearerX ${SECRET}`), SECRET)).toBe(false)
  })
})
