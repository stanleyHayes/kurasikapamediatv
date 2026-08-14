import { SignJWT, importPKCS8 } from 'jose'
import type { ClockPort } from '@kurasikapa/application'
import { failOAuth } from './claims'

/**
 * Apple's `client_secret`, minted rather than stored.
 *
 * Unlike Google and Facebook, Apple hands over no secret string. The client
 * secret is an ES256 JWT signed with a downloaded .p8 key, valid for at most
 * six months. Signing one per request would spend a PKCS#8 import and an ECDSA
 * signature on every sign-in for a credential that outlives the deploy, so it
 * is cached until shortly before its own `exp`.
 *
 * It lives in its own file for two reasons: it takes apple.ts under the
 * 250-line cap, and the cache boundary — "does the second call re-sign?" — is
 * only testable if it can be driven independently with a controlled clock.
 */

/**
 * Apple's issuer identifier. It is both the audience of the client secret
 * below and the issuer of the id_token apple.ts verifies, so it is declared
 * once here and imported there rather than written down twice.
 */
export const APPLE_ISSUER = 'https://appleid.apple.com'

/**
 * Apple rejects a client secret whose `exp` is more than 15,777,000 seconds
 * (six months) out, measured on APPLE's clock rather than ours. 150 days
 * leaves a month of slack, so a server clock running fast cannot push the
 * secret over the cap and turn every sign-in into `invalid_client`.
 */
const LIFETIME_SECONDS = 150 * 24 * 60 * 60

/** Re-sign a day early: a request that starts before `exp` must not arrive after it. */
const RENEWAL_MARGIN_MS = 24 * 60 * 60 * 1000

/**
 * Pinned from Apple's discovery document: the client secret must be ES256.
 * Naming it stops the JWT nominating its own algorithm.
 */
const ALGORITHM = 'ES256'

/** Everything the signature needs, and nothing about the sign-in flow. */
export interface AppleSigningKey {
  /** The Services ID — subject of the client secret, audience of the id_token. */
  readonly servicesId: string
  /** 10-character Team ID. Issues the client secret. */
  readonly teamId: string
  /** 10-character Key ID of the .p8 key, carried in the JWT header as `kid`. */
  readonly keyId: string
  /** The .p8 file's contents, PEM PKCS#8, with real newlines already restored. */
  readonly privateKeyPkcs8: string
}

interface SignedClientSecret {
  readonly jwt: string
  readonly renewAtMs: number
}

export class AppleClientSecret {
  private cached: SignedClientSecret | null = null

  constructor(
    private readonly key: AppleSigningKey,
    private readonly clock: ClockPort,
  ) {}

  /** The current secret, signed at most twice a year. */
  async current(): Promise<string> {
    // Injected, not ambient. What is measured here is a credential's TTL as
    // Apple's servers see it, and a test that cannot move this number cannot
    // prove the cache ever renews — the failure it guards against is a
    // six-month-old secret being presented on every sign-in until Apple
    // answers `invalid_client` and nobody can sign in at all.
    const nowMs = this.clock.now().getTime()
    const cached = this.cached

    if (cached !== null && nowMs < cached.renewAtMs) {
      return cached.jwt
    }

    const jwt = await this.sign(Math.floor(nowMs / 1000))
    this.cached = { jwt, renewAtMs: nowMs + LIFETIME_SECONDS * 1000 - RENEWAL_MARGIN_MS }

    return jwt
  }

  private async sign(issuedAt: number): Promise<string> {
    try {
      const signingKey = await importPKCS8(this.key.privateKeyPkcs8, ALGORITHM)

      return await new SignJWT()
        // `kid` is how Apple chooses which of your keys to verify against.
        // Omit it and the answer is `invalid_client` with no further detail.
        .setProtectedHeader({ alg: ALGORITHM, kid: this.key.keyId })
        // Team issues it, Services ID is its subject, Apple is the audience.
        // Swapping iss and sub is the most common `invalid_client` there is.
        .setIssuer(this.key.teamId)
        .setSubject(this.key.servicesId)
        .setAudience(APPLE_ISSUER)
        // Absolute Unix seconds, from the same clock read the cache budgeted
        // against. A string would mean "a span from now" and read jose's own
        // clock instead, letting the cache outlive the token it caches.
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + LIFETIME_SECONDS)
        .sign(signingKey)
    } catch {
      // The cause is dropped on purpose. This is a configuration fault, and
      // the underlying key-parsing error is the one message in this adapter
      // that could carry private key material into a log line.
      failOAuth('apple', 'client secret could not be signed')
    }
  }
}
