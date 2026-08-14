import type { UserId } from '../shared/ids'

/**
 * A refresh token, and the rules that make one safe to hand out for a month.
 *
 * Three properties do the work:
 *
 * 1. **Single use.** Redeeming a refresh token rotates it: the old one is
 *    marked spent and a new one is issued. A token is therefore valid exactly
 *    once.
 * 2. **Reuse is theft.** Because a valid token is redeemed exactly once, a
 *    SECOND presentation of an already-spent token means two parties hold it —
 *    the legitimate client and somebody else. There is no innocent explanation
 *    that we can distinguish, so the whole family is revoked and both are
 *    signed out. Annoying once; the alternative is an attacker refreshing
 *    quietly forever.
 * 3. **Stored, not stateless.** Only the HASH is stored. A database leak must
 *    not hand over usable sessions, exactly as it must not hand over passwords.
 *
 * This is the OAuth 2.0 Security BCP's rotation-with-reuse-detection, applied
 * to our own sessions.
 */
export type RefreshTokenState = 'active' | 'rotated' | 'revoked'

export interface RefreshTokenRecord {
  /** Opaque id of this individual token. */
  readonly id: string
  /** The session family. Every token rotated from the same sign-in shares it. */
  readonly sessionId: string
  readonly userId: UserId
  /** SHA-256 of the token; the token itself is never stored. */
  readonly tokenHash: string
  readonly state: RefreshTokenState
  readonly expiresAt: Date
  readonly createdAt: Date
}

export class RefreshTokenExpired extends Error {
  constructor() {
    super('This session has expired. Please sign in again.')
    this.name = 'RefreshTokenExpired'
  }
}

export class RefreshTokenRevoked extends Error {
  constructor() {
    super('This session is no longer valid. Please sign in again.')
    this.name = 'RefreshTokenRevoked'
  }
}

/**
 * Carries the family so the caller can revoke it. The message is deliberately
 * identical to the revoked one — the person holding a stolen token learns
 * nothing about why it stopped working.
 */
export class RefreshTokenReused extends Error {
  constructor(readonly sessionId: string) {
    super('This session is no longer valid. Please sign in again.')
    this.name = 'RefreshTokenReused'
  }
}

/**
 * Decides whether a presented refresh token may be redeemed.
 *
 * Order matters. `rotated` is checked FIRST, before expiry, because a replayed
 * spent token is a security event whatever its expiry says — and an attacker
 * replaying an old token past its expiry should still burn the family rather
 * than get a bland "expired".
 */
export function assertRedeemable(record: RefreshTokenRecord, now: Date): void {
  if (record.state === 'rotated') throw new RefreshTokenReused(record.sessionId)
  if (record.state === 'revoked') throw new RefreshTokenRevoked()
  if (now.getTime() >= record.expiresAt.getTime()) throw new RefreshTokenExpired()
}

/** True when this presentation is evidence the token leaked. */
export function isReuse(record: RefreshTokenRecord): boolean {
  return record.state === 'rotated'
}
