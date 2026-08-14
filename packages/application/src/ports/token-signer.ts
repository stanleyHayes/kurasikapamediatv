import type { SessionClaims } from '@kurasikapa/domain'

/**
 * Signing and verifying session tokens.
 *
 * The domain decides WHAT a token says and for how long (session-policy.ts);
 * this port only turns those claims into a string and back. Keeping the split
 * means the expiry rules are unit-testable without a key, and swapping HS256
 * for asymmetric keys later is an adapter change.
 */
export class InvalidToken extends Error {
  constructor(reason: string) {
    super(`Token rejected: ${reason}`)
    this.name = 'InvalidToken'
  }
}

export interface TokenSigner {
  sign(claims: SessionClaims): Promise<string>

  /**
   * Verifies the signature and returns the claims.
   *
   * THROWS `InvalidToken` for anything it will not vouch for — bad signature,
   * wrong issuer, malformed, unsupported algorithm. It must never return
   * unverified claims, and it must never accept `alg: none` or let the token
   * choose its own algorithm; that is the classic JWT forgery.
   *
   * Expiry is deliberately NOT checked here. The domain checks it, with an
   * injected clock, so the rule is testable and the tolerance is one number in
   * one place.
   */
  verify(token: string): Promise<SessionClaims>
}
