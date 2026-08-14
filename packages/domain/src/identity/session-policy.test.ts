import { describe, expect, it } from 'vitest'
import { userId } from '../shared/ids'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CHALLENGE_TOKEN_TTL_SECONDS,
  CLOCK_SKEW_TOLERANCE_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  TokenExpired,
  WrongTokenKind,
  assertUsable,
  claimsFor,
  ttlFor,
} from './session-policy'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const at = (secondsFromNow: number): Date => new Date(NOW.getTime() + secondsFromNow * 1000)

const access = claimsFor({
  userId: userId('u1'),
  sessionId: 's1',
  kind: 'access',
  now: NOW,
})

describe('claimsFor', () => {
  it('carries the user and the session family, and nothing else identifying', () => {
    expect(access.sub).toBe('u1')
    expect(access.sid).toBe('s1')
    expect(access.kind).toBe('access')
  })

  it('does NOT carry roles', () => {
    // The rule the whole authorisation model rests on: roles are read per
    // request, so a revocation lands immediately instead of whenever the token
    // happens to expire. A `roles` claim here would silently undo that.
    expect(Object.keys(access).sort()).toStrictEqual(['exp', 'iat', 'kind', 'sid', 'sub'])
  })

  it('stamps iat and exp in SECONDS, as JWT requires', () => {
    // Milliseconds here would make every token look ~50,000 years old to any
    // standards-compliant verifier.
    expect(access.iat).toBe(Math.floor(NOW.getTime() / 1000))
    expect(access.exp - access.iat).toBe(ACCESS_TOKEN_TTL_SECONDS)
  })

  it('gives a refresh token the long lifetime', () => {
    const refresh = claimsFor({
      userId: userId('u1'),
      sessionId: 's1',
      kind: 'refresh',
      now: NOW,
    })

    expect(refresh.exp - refresh.iat).toBe(REFRESH_TOKEN_TTL_SECONDS)
  })

  it('keeps access much shorter than refresh', () => {
    // An access token cannot be revoked. Its lifetime IS the containment.
    expect(ttlFor('access')).toBeLessThan(ttlFor('refresh'))
    expect(ACCESS_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(15 * 60)
  })
})

describe('assertUsable', () => {
  it('accepts a fresh token of the right kind', () => {
    expect(() => assertUsable(access, 'access', NOW)).not.toThrow()
  })

  it('accepts a token right up to its expiry', () => {
    expect(() => assertUsable(access, 'access', at(ACCESS_TOKEN_TTL_SECONDS - 1))).not.toThrow()
  })

  it('refuses a token past expiry plus the skew tolerance', () => {
    const wellPast = at(ACCESS_TOKEN_TTL_SECONDS + CLOCK_SKEW_TOLERANCE_SECONDS + 1)

    expect(() => assertUsable(access, 'access', wellPast)).toThrow(TokenExpired)
  })

  it('forgives a small clock skew rather than rejecting a token it just minted', () => {
    // Two of our own serverless instances, one second apart, must not produce
    // a sign-in that fails for nobody reproducibly.
    const justPast = at(ACCESS_TOKEN_TTL_SECONDS + 1)

    expect(() => assertUsable(access, 'access', justPast)).not.toThrow()
  })

  describe('token kind', () => {
    it('refuses an access token presented for refresh', () => {
      // This is the important one. Same secret, same signature, different
      // meaning — without this claim an access token from any request could be
      // traded for a fresh 30-day session, forever.
      expect(() => assertUsable(access, 'refresh', NOW)).toThrow(WrongTokenKind)
    })

    it('refuses a refresh token presented as an access token', () => {
      const refresh = claimsFor({
        userId: userId('u1'),
        sessionId: 's1',
        kind: 'refresh',
        now: NOW,
      })

      expect(() => assertUsable(refresh, 'access', NOW)).toThrow(WrongTokenKind)
    })

    it('checks kind BEFORE expiry, so a confused caller is told the real problem', () => {
      const stale = at(REFRESH_TOKEN_TTL_SECONDS * 2)

      expect(() => assertUsable(access, 'refresh', stale)).toThrow(WrongTokenKind)
    })

    it('names both kinds, so a log line is diagnosable', () => {
      expect(() => assertUsable(access, 'refresh', NOW)).toThrow(/refresh.*access/u)
    })
  })

  it('tells a reader what to do, not what went wrong internally', () => {
    const wellPast = at(REFRESH_TOKEN_TTL_SECONDS * 2)

    expect(() => assertUsable(access, 'access', wellPast)).toThrow(/sign in again/iu)
  })
})

describe('the challenge kind', () => {
  const challenge = claimsFor({
    userId: userId('u1'),
    sessionId: 's1',
    kind: 'challenge',
    now: NOW,
  })

  it('lives long enough to open an authenticator, and no longer', () => {
    expect(challenge.exp - challenge.iat).toBe(CHALLENGE_TOKEN_TTL_SECONDS)
    expect(CHALLENGE_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(5 * 60)
  })

  it('is NOT accepted where an access token is expected', () => {
    // The whole point of the second factor: knowing the password gets you a
    // challenge, not a session. If this passed, 2FA would be decorative.
    expect(() => assertUsable(challenge, 'access', NOW)).toThrow(WrongTokenKind)
  })

  it('cannot be traded for a refresh either', () => {
    expect(() => assertUsable(challenge, 'refresh', NOW)).toThrow(WrongTokenKind)
  })

  it('is accepted at the second-factor step it was minted for', () => {
    expect(() => assertUsable(challenge, 'challenge', NOW)).not.toThrow()
  })

  it('expires on its own schedule', () => {
    const past = at(CHALLENGE_TOKEN_TTL_SECONDS + CLOCK_SKEW_TOLERANCE_SECONDS + 1)

    expect(() => assertUsable(challenge, 'challenge', past)).toThrow(TokenExpired)
  })
})
