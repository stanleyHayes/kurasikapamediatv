import { assertRedeemable, isReuse } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { RefreshTokenRepository } from '../ports/refresh-token-repository'
import type { SecretGenerator } from '../ports/totp'
import type { UseCase } from '../ports/use-case'
import type { SessionIssuer, SessionTokens } from './issue-session'

export interface RefreshInput {
  readonly refreshToken: string
}

export class SessionNotRefreshable extends Error {
  constructor() {
    // One message for unknown, expired, revoked and REUSED. Distinguishing
    // them would tell whoever holds a stolen token whether they were detected.
    super('This session is no longer valid. Please sign in again.')
    this.name = 'SessionNotRefreshable'
  }
}

export interface RefreshDeps {
  readonly refreshTokens: RefreshTokenRepository
  readonly secrets: SecretGenerator
  readonly sessions: SessionIssuer
  readonly clock: ClockPort
}

/**
 * Trades a refresh token for a new pair, and treats reuse as theft.
 *
 * Rotation is what makes a thirty-day session tolerable: a token is valid
 * exactly once, so a stolen one is a race the attacker only wins if they use
 * it before the reader does — and if they lose, the second presentation
 * reveals them.
 *
 * There is no way to tell WHICH party is the impostor when a spent token comes
 * back, so both are signed out. That is the correct trade: one unexpected
 * sign-in beats an attacker refreshing quietly for a month.
 */
export class RefreshSession implements UseCase<RefreshInput, SessionTokens> {
  constructor(private readonly deps: RefreshDeps) {}

  async execute(input: RefreshInput): Promise<SessionTokens> {
    const hash = this.deps.secrets.sha256(input.refreshToken)
    const record = await this.deps.refreshTokens.findByHash(hash)

    if (record === null) throw new SessionNotRefreshable()

    if (isReuse(record)) {
      // Burn the whole family BEFORE answering. An attacker who gets a reply
      // first and a revocation second has had a window; there is no reason to
      // give them one.
      await this.deps.refreshTokens.revokeFamily(record.sessionId)
      throw new SessionNotRefreshable()
    }

    try {
      assertRedeemable(record, this.deps.clock.now())
    } catch {
      throw new SessionNotRefreshable()
    }

    return this.deps.sessions.rotate(record)
  }
}
