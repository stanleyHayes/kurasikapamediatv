import { describe, expect, it } from 'vitest'
import { userId } from '../shared/ids'
import {
  RefreshTokenExpired,
  RefreshTokenReused,
  RefreshTokenRevoked,
  type RefreshTokenRecord,
  type RefreshTokenState,
  assertRedeemable,
  isReuse,
} from './refresh-token'

const NOW = new Date('2026-08-14T10:00:00.000Z')

const record = (state: RefreshTokenState, expiresAt = new Date(NOW.getTime() + 60_000)): RefreshTokenRecord => ({
  id: 'rt1',
  sessionId: 'sess1',
  userId: userId('u1'),
  tokenHash: 'sha256:abc',
  state,
  expiresAt,
  createdAt: new Date(NOW.getTime() - 60_000),
})

describe('assertRedeemable', () => {
  it('lets an active, unexpired token through', () => {
    expect(() => assertRedeemable(record('active'), NOW)).not.toThrow()
  })

  it('refuses an expired token', () => {
    const expired = record('active', new Date(NOW.getTime() - 1))

    expect(() => assertRedeemable(expired, NOW)).toThrow(RefreshTokenExpired)
  })

  it('treats the expiry instant itself as expired', () => {
    expect(() => assertRedeemable(record('active', NOW), NOW)).toThrow(RefreshTokenExpired)
  })

  it('refuses a token whose session was signed out', () => {
    expect(() => assertRedeemable(record('revoked'), NOW)).toThrow(RefreshTokenRevoked)
  })

  describe('reuse — the theft signal', () => {
    it('refuses a token that was already spent', () => {
      // A valid refresh token is redeemed exactly once. A second presentation
      // means two parties hold it, and we cannot tell which one is the reader.
      expect(() => assertRedeemable(record('rotated'), NOW)).toThrow(RefreshTokenReused)
    })

    it('carries the session family, so the caller can burn all of it', () => {
      try {
        assertRedeemable(record('rotated'), NOW)
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(RefreshTokenReused)
        expect((error as RefreshTokenReused).sessionId).toBe('sess1')
      }
    })

    it('reports reuse even when the token is ALSO expired', () => {
      // Checked before expiry on purpose: an attacker replaying a stale stolen
      // token should still burn the family, not get a bland "expired" while the
      // legitimate session keeps running.
      const spentAndStale = record('rotated', new Date(NOW.getTime() - 10_000))

      expect(() => assertRedeemable(spentAndStale, NOW)).toThrow(RefreshTokenReused)
    })

    it('says the same thing to the thief as to a signed-out user', () => {
      // Distinguishable messages would tell whoever holds a stolen token
      // whether they were detected.
      const reused = new RefreshTokenReused('sess1').message
      const revoked = new RefreshTokenRevoked().message

      expect(reused).toBe(revoked)
    })
  })
})

describe('isReuse', () => {
  it.each([
    ['active', false],
    ['revoked', false],
    ['rotated', true],
  ] as const)('%s -> %s', (state, expected) => {
    expect(isReuse(record(state))).toBe(expected)
  })
})
