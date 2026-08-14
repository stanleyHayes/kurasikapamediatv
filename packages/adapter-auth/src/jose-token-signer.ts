import { SignJWT, errors, jwtVerify } from 'jose'
import type { SessionClaims, TokenKind } from '@kurasikapa/domain'
import { InvalidToken, type TokenSigner } from '@kurasikapa/application'

/**
 * Session tokens, signed with HS256.
 *
 * Symmetric because exactly one process verifies these: `apps/web` signs and
 * both Next apps verify with the same secret they already share. The moment
 * `services/api` (Go) needs to verify a session cookie, this becomes ES256 and
 * Go gets only the public half — the call shape below is unchanged, so that is
 * an adapter edit, not a redesign.
 */
const ALGORITHM = 'HS256'

export interface JoseTokenSignerConfig {
  /** At least 32 bytes. Validated at the composition root, not here. */
  readonly secret: string
  readonly issuer: string
  readonly audience: string
}

interface RawClaims {
  readonly sid?: unknown
  readonly kind?: unknown
}

export class JoseTokenSigner implements TokenSigner {
  private readonly key: Uint8Array

  constructor(private readonly config: JoseTokenSignerConfig) {
    // Encoded once. jose requires bytes, and a string silently means something
    // different (a JWK lookup) rather than failing loudly.
    this.key = new TextEncoder().encode(config.secret)
  }

  async sign(claims: SessionClaims): Promise<string> {
    return new SignJWT({ sid: claims.sid, kind: claims.kind })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      // Absolute Unix seconds, which is what the domain already computed. A
      // string here would mean "a span from now" and quietly ignore the
      // domain's expiry policy.
      .setIssuedAt(claims.iat)
      .setExpirationTime(claims.exp)
      .sign(this.key)
  }

  /**
   * Verifies signature, issuer, audience and shape — and nothing about time.
   *
   * `clockTolerance` is deliberately huge rather than zero: expiry is the
   * DOMAIN's rule, checked by `assertUsable` against an injected clock, so it
   * is testable and the tolerance is one number in one place. Letting jose
   * also reject on `exp` would mean two expiry policies that must agree, and
   * the domain's would be the one nobody could see failing.
   */
  async verify(token: string): Promise<SessionClaims> {
    // Narrow try: it wraps ONLY the jose call. Extracting the claims inside it
    // would let `toSessionClaims`'s own precise InvalidToken be caught by the
    // catch below and re-flattened into "malformed" — losing the one detail
    // that says which claim was missing.
    let payload: Record<string, unknown>

    try {
      ;({ payload } = await jwtVerify(token, this.key, {
        // Pinned. Without this a token may nominate its own algorithm, which
        // is the classic JWT forgery — including `alg: none`.
        algorithms: [ALGORITHM],
        issuer: this.config.issuer,
        audience: this.config.audience,
        typ: 'JWT',
        // `exp` is NOT required by default; a token minted without one would
        // otherwise verify happily and never expire.
        requiredClaims: ['sub', 'exp', 'iat'],
        clockTolerance: Number.MAX_SAFE_INTEGER,
      }))
    } catch (error) {
      throw new InvalidToken(describe(error))
    }

    return toSessionClaims(payload)
  }
}

function toSessionClaims(payload: Record<string, unknown>): SessionClaims {
  const { sub, iat, exp } = payload as { sub?: string; iat?: number; exp?: number }
  const { sid, kind } = payload as RawClaims

  if (sub === undefined || iat === undefined || exp === undefined) {
    throw new InvalidToken('missing standard claims')
  }
  if (typeof sid !== 'string' || !isTokenKind(kind)) {
    throw new InvalidToken('missing session claims')
  }

  return { sub, sid, kind, iat, exp } as SessionClaims
}

const KINDS: readonly string[] = ['access', 'refresh', 'challenge']

const isTokenKind = (value: unknown): value is TokenKind =>
  typeof value === 'string' && KINDS.includes(value)

/**
 * Turns a jose failure into a short reason.
 *
 * Switches on `err.code`, NOT `instanceof`. `JWTExpired` extends `JOSEError`
 * directly rather than `JWTClaimValidationFailed`, so the obvious instanceof
 * chain silently misses it. Key and PEM problems arrive as bare `TypeError`
 * with no code at all, which is why the fallback is load-bearing.
 */
function describe(error: unknown): string {
  const code = (error as errors.JOSEError | undefined)?.code

  switch (code) {
    case 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED':
      return 'signature did not verify'
    case 'ERR_JWT_EXPIRED':
      return 'expired'
    case 'ERR_JOSE_ALG_NOT_ALLOWED':
      return 'unexpected algorithm'
    case 'ERR_JWT_CLAIM_VALIDATION_FAILED':
      return 'claim validation failed'
    default:
      return 'malformed'
  }
}
