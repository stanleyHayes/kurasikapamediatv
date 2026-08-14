import { claimsFor, ttlFor, type RefreshTokenRecord, type UserId } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { NewRefreshToken, RefreshTokenRepository } from '../ports/refresh-token-repository'
import type { SecretGenerator } from '../ports/totp'
import type { TokenSigner } from '../ports/token-signer'

/**
 * What a signed-in caller receives.
 *
 * `expiresIn` values are seconds, not Dates, so the transport layer can set a
 * cookie `maxAge` without arithmetic against a clock it is not allowed to read.
 */
export interface SessionTokens {
  readonly accessToken: string
  readonly refreshToken: string
  readonly sessionId: string
  readonly accessExpiresInSeconds: number
  readonly refreshExpiresInSeconds: number
}

export interface SessionIssuerDeps {
  readonly tokens: TokenSigner
  readonly refreshTokens: RefreshTokenRepository
  readonly secrets: SecretGenerator
  readonly clock: ClockPort
  readonly ids: IdPort
}

/**
 * Mints a session, and stores the half of it that can be revoked.
 *
 * Shared by every path that produces a signed-in state — password, second
 * factor, provider, refresh — because the alternative is four places that must
 * agree about lifetimes, hashing and family ids, and eventually will not.
 *
 * The two tokens are deliberately different KINDS of thing:
 *
 * - The **access token is a signed JWT**. It is checked on every request, and
 *   a signature check is the difference between one cheap verification and a
 *   database round trip per page view. The cost is that it cannot be revoked,
 *   which its fifteen-minute life bounds.
 *
 * - The **refresh token is opaque randomness** — no JWT. It is looked up in the
 *   store on every use anyway, so a signature would add a forgery surface and
 *   buy nothing. What is stored is its SHA-256, exactly as for a password: a
 *   database leak must not hand over live sessions.
 */
export class SessionIssuer {
  /** 256 bits. Guessing is not a threat model at this width. */
  private static readonly REFRESH_TOKEN_BYTES = 32

  constructor(private readonly deps: SessionIssuerDeps) {}

  /** Starts a brand new session family. */
  async issue(userId: UserId): Promise<SessionTokens> {
    const { tokens, record } = await this.build(userId, this.deps.ids.next())
    await this.deps.refreshTokens.create(record)

    return tokens
  }

  /**
   * Continues an existing family — same `sid`, new tokens, old one spent.
   *
   * Goes through `rotate` rather than `create` because marking the presented
   * token spent IS the rotation. Issuing a replacement without spending the
   * original leaves it `active` forever: it can be refreshed again and again,
   * reuse detection never fires, and a stolen refresh token is good for its
   * full thirty days. That is the whole security property of this design, and
   * it is one forgotten call away from being absent.
   */
  async rotate(spent: RefreshTokenRecord): Promise<SessionTokens> {
    const { tokens, record } = await this.build(spent.userId, spent.sessionId)
    await this.deps.refreshTokens.rotate(spent.id, record)

    return tokens
  }

  private async build(
    userId: UserId,
    sessionId: string,
  ): Promise<{ tokens: SessionTokens; record: NewRefreshToken }> {
    const now = this.deps.clock.now()

    const accessToken = await this.deps.tokens.sign(
      claimsFor({ userId, sessionId, kind: 'access', now }),
    )

    const refreshToken = this.deps.secrets.token(SessionIssuer.REFRESH_TOKEN_BYTES)

    return {
      record: {
        id: this.deps.ids.next(),
        sessionId,
        userId,
        tokenHash: this.deps.secrets.sha256(refreshToken),
        expiresAt: new Date(now.getTime() + ttlFor('refresh') * 1000),
        createdAt: now,
      },
      tokens: {
        accessToken,
        refreshToken,
        sessionId,
        accessExpiresInSeconds: ttlFor('access'),
        refreshExpiresInSeconds: ttlFor('refresh'),
      },
    }
  }
}
