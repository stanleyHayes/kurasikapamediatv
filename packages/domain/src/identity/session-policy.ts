import type { UserId } from '../shared/ids'

/**
 * What a session token may say, and for how long.
 *
 * The single most important rule here is what a token does NOT carry: roles.
 *
 * Roles are read from `role_assignments` on every request (see ResolveActor).
 * Putting them in the token would make a revocation take effect whenever the
 * token happened to expire — up to fifteen minutes of an ex-editor still being
 * able to publish. That is the whole reason authorisation stayed in the domain
 * when authentication was vendor work, and it does not change because the
 * vendor did.
 *
 * So a token answers exactly one question: WHICH USER is this? Everything else
 * is looked up.
 */

/**
 * Access tokens are short. They cannot be revoked — that is what "stateless"
 * costs — so the window in which a stolen one is useful is the only control,
 * and fifteen minutes is short enough to matter without making refresh chatty.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

/**
 * Refresh tokens are long, and revocable, because they are stored. Thirty days
 * matches what readers expect from a news site: sign in once a month, not once
 * a week.
 */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * Tolerance for clock skew between the signer and the verifier.
 *
 * Both are our own servers, but "our own servers" includes a serverless
 * instance whose clock drifted a second. Without this, a token minted at the
 * boundary is occasionally rejected the instant it is issued — a bug that
 * reproduces for nobody.
 */
export const CLOCK_SKEW_TOLERANCE_SECONDS = 30

/**
 * Short-lived proof that a password was accepted but the second factor has
 * not been presented yet.
 *
 * Five minutes: long enough to open an authenticator app and type six digits,
 * short enough that a challenge captured from a URL or a log is useless by the
 * time anyone reads it.
 */
export const CHALLENGE_TOKEN_TTL_SECONDS = 5 * 60

/**
 * A challenge is a THIRD kind, not an access token with a flag.
 *
 * The kind check in `assertUsable` is the control: without a distinct kind, a
 * half-authenticated challenge would verify anywhere an access token does, and
 * "knows the password" would silently become "is signed in" — defeating the
 * second factor entirely.
 */
export type TokenKind = 'access' | 'refresh' | 'challenge'

/**
 * The claims we mint. Deliberately small.
 *
 * `sid` ties an access token to the refresh-token family it came from, so
 * revoking a session invalidates the next refresh even though the outstanding
 * access token has to be waited out.
 */
export interface SessionClaims {
  /** Subject — the user id. */
  readonly sub: UserId
  /** Session id — the family this token belongs to. */
  readonly sid: string
  /** Which kind of token this is; an access token must never refresh. */
  readonly kind: TokenKind
  /** Issued at, seconds since epoch. */
  readonly iat: number
  /** Expires at, seconds since epoch. */
  readonly exp: number
}

export class TokenExpired extends Error {
  constructor() {
    super('This session has expired. Please sign in again.')
    this.name = 'TokenExpired'
  }
}

export class WrongTokenKind extends Error {
  constructor(
    readonly expected: TokenKind,
    readonly actual: TokenKind,
  ) {
    super(`Expected a ${expected} token, got a ${actual} token`)
    this.name = 'WrongTokenKind'
  }
}

const toSeconds = (at: Date): number => Math.floor(at.getTime() / 1000)

const TTL: Readonly<Record<TokenKind, number>> = {
  access: ACCESS_TOKEN_TTL_SECONDS,
  refresh: REFRESH_TOKEN_TTL_SECONDS,
  challenge: CHALLENGE_TOKEN_TTL_SECONDS,
}

export function ttlFor(kind: TokenKind): number {
  return TTL[kind]
}

/**
 * Builds the claims for a new token.
 *
 * `now` is a parameter, never read from the clock here — AGENTS.md § 5. A test
 * that cannot control time cannot test an expiry rule.
 */
export function claimsFor(input: {
  readonly userId: UserId
  readonly sessionId: string
  readonly kind: TokenKind
  readonly now: Date
}): SessionClaims {
  const iat = toSeconds(input.now)

  return {
    sub: input.userId,
    sid: input.sessionId,
    kind: input.kind,
    iat,
    exp: iat + ttlFor(input.kind),
  }
}

/**
 * Refuses a token that has expired or is being used for the wrong purpose.
 *
 * The kind check is not ceremony. Without it, an access token — which lives in
 * a cookie sent on every request and is never revocable — would be accepted at
 * the refresh endpoint and could be traded for a fresh thirty-day session
 * forever. Same signature, same secret, different meaning; only this claim
 * separates them.
 */
export function assertUsable(claims: SessionClaims, expected: TokenKind, now: Date): void {
  if (claims.kind !== expected) throw new WrongTokenKind(expected, claims.kind)

  if (toSeconds(now) - CLOCK_SKEW_TOLERANCE_SECONDS >= claims.exp) throw new TokenExpired()
}
