import type { RefreshTokenRecord, UserId } from '@kurasikapa/domain'

/**
 * Where refresh tokens live.
 *
 * Sessions are stored precisely so they can be ended. A fully stateless design
 * cannot revoke anything before expiry, which for a thirty-day session means a
 * stolen token outlives the incident response.
 */
export interface NewRefreshToken {
  readonly id: string
  readonly sessionId: string
  readonly userId: UserId
  readonly tokenHash: string
  readonly expiresAt: Date
  readonly createdAt: Date
}

export interface RefreshTokenRepository {
  /** Looks up by hash — the token itself is never stored, like a password. */
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>

  create(token: NewRefreshToken): Promise<void>

  /**
   * Marks a token spent and stores its replacement, ATOMICALLY.
   *
   * Atomic because the pair is the whole security property. Two concurrent
   * refreshes with a non-atomic swap both read `active`, both mint a token,
   * and the reuse detector never fires — which is exactly the case it exists
   * to catch. Must fail if the token is no longer `active`.
   */
  rotate(spentId: string, replacement: NewRefreshToken): Promise<void>

  /**
   * Ends every token in a session family.
   *
   * Called on sign-out, and on reuse detection — where it is the response to
   * evidence that two parties hold the same token.
   */
  revokeFamily(sessionId: string): Promise<void>

  /** Ends every session a user has. For a password change, or a lockout. */
  revokeAllForUser(userId: UserId): Promise<void>
}
