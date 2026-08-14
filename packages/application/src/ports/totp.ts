/**
 * The arithmetic behind time-based one-time codes.
 *
 * The RULES — how wide the drift window is, what counts as a replay, how many
 * recovery codes an enrolment gets — live in the domain (`totp-policy.ts`).
 * This port is only HMAC and base32, which need crypto and therefore cannot.
 */
export interface TotpPort {
  /** A fresh base32 shared secret, from a cryptographic source. */
  generateSecret(): string

  /** The code an authenticator would show for this secret at this counter. */
  codeAt(secret: string, counter: number): string

  /**
   * The `otpauth://` URI an authenticator app scans.
   *
   * Built here because it must encode the same digits and period the code
   * generator uses; splitting them is how a QR code ends up describing a
   * different algorithm from the one that verifies it.
   */
  provisioningUri(input: {
    readonly secret: string
    readonly account: string
    readonly issuer: string
  }): string
}

/**
 * Cryptographic randomness and hashing for things that are not passwords.
 *
 * Refresh tokens, recovery codes, OAuth `state` and PKCE verifiers all need
 * unguessable values, and the tokens need a one-way hash for storage. Password
 * hashing is deliberately NOT here — it needs a slow, salted, tunable
 * algorithm, which is a different port with different properties.
 */
export interface SecretGenerator {
  /** A URL-safe random string with at least `bytes` bytes of entropy. */
  token(bytes: number): string

  /**
   * SHA-256, hex encoded. Fast on purpose: these values are already
   * high-entropy, so there is nothing for an attacker to brute force and
   * nothing a slow hash would buy.
   */
  sha256(value: string): string

  /** Constant-time comparison, for checking a presented recovery code. */
  equals(a: string, b: string): boolean
}
