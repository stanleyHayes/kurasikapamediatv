import {
  InvalidTotpCode,
  acceptableCounters,
  assertNotReplayed,
  assertUsable,
  isWellFormedCode,
  normaliseCode,
  type Credential,
} from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { CredentialRepository } from '../ports/credential-repository'
import type { RateLimitRule, RateLimiter } from '../ports/rate-limit'
import type { SecretGenerator, TotpPort } from '../ports/totp'
import type { TokenSigner } from '../ports/token-signer'
import type { UseCase } from '../ports/use-case'
import type { SessionIssuer, SessionTokens } from './issue-session'

export interface SecondFactorInput {
  /** The challenge minted when the password was accepted. */
  readonly challengeToken: string
  /** A six-digit authenticator code, OR one recovery code. */
  readonly code: string
  readonly callerKey: string
}

export interface SecondFactorDeps {
  readonly credentials: CredentialRepository
  readonly tokens: TokenSigner
  readonly totp: TotpPort
  readonly secrets: SecretGenerator
  readonly sessions: SessionIssuer
  readonly limiter: RateLimiter
  readonly clock: ClockPort
}

/**
 * Ten a minute.
 *
 * A six-digit code is one in a million per guess, but the drift window makes
 * three of them live at once and an unthrottled endpoint turns that into a
 * feasible online attack. Ten leaves room for mistyping.
 */
const RULE: RateLimitRule = { limit: 10, windowSeconds: 60 }

export class SecondFactorThrottled extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many attempts. Please wait and try again.')
    this.name = 'SecondFactorThrottled'
  }
}

/**
 * Turns a challenge plus a correct code into a session.
 *
 * The challenge is what proves the password step happened. Without it this
 * endpoint would accept a code for any account from anybody — which is how a
 * second factor becomes the ONLY factor.
 */
export class CompleteSecondFactor implements UseCase<SecondFactorInput, SessionTokens> {
  constructor(private readonly deps: SecondFactorDeps) {}

  async execute(input: SecondFactorInput): Promise<SessionTokens> {
    const verdict = await this.deps.limiter.consume(`2fa:${input.callerKey}`, RULE)
    if (!verdict.allowed) throw new SecondFactorThrottled(verdict.retryAfterSeconds)

    const credential = await this.resolveChallenge(input.challengeToken)
    const code = normaliseCode(input.code)

    const accepted = isWellFormedCode(code)
      ? await this.acceptTotp(credential, code)
      : await this.acceptRecoveryCode(credential, code)

    if (!accepted) throw new InvalidTotpCode()

    return this.deps.sessions.issue(credential.userId)
  }

  private async resolveChallenge(token: string): Promise<Credential> {
    const claims = await this.deps.tokens.verify(token)

    // The kind check is the control. An access token presented here would let
    // anyone already signed in mint a session for the account it names.
    assertUsable(claims, 'challenge', this.deps.clock.now())

    const credential = await this.deps.credentials.findByUserId(claims.sub)
    if (!credential?.requiresSecondFactor) throw new InvalidTotpCode()

    return credential
  }

  private async acceptTotp(credential: Credential, code: string): Promise<boolean> {
    const enrolment = credential.totp
    if (enrolment === null) return false

    const now = this.deps.clock.now()

    for (const counter of acceptableCounters(now)) {
      if (!this.deps.secrets.equals(this.deps.totp.codeAt(enrolment.secret, counter), code)) {
        continue
      }

      // Correct, but possibly a replay from inside the drift window. Throws
      // rather than returning false: the code WAS right, and reporting it as
      // wrong would send someone to check their authenticator for no reason.
      assertNotReplayed(counter, enrolment.lastUsedCounter)
      await this.deps.credentials.update(credential.recordTotpUse(counter, now))

      return true
    }

    return false
  }

  /**
   * Recovery codes are single use, and burned even though the caller is about
   * to be signed in — the whole point is that a printed list shrinks.
   */
  private async acceptRecoveryCode(credential: Credential, code: string): Promise<boolean> {
    const enrolment = credential.totp
    if (enrolment === null) return false

    const presented = this.deps.secrets.sha256(code)
    const match = enrolment.recoveryCodeHashes.find((stored) =>
      this.deps.secrets.equals(stored, presented),
    )
    if (match === undefined) return false

    await this.deps.credentials.update(
      credential.consumeRecoveryCode(match, this.deps.clock.now()),
    )

    return true
  }
}
