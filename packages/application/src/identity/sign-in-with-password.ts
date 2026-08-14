import {
  EmailAddress,
  claimsFor,
  type Credential,
  type UserId,
} from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { CredentialRepository } from '../ports/credential-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { RateLimitRule, RateLimiter } from '../ports/rate-limit'
import type { TokenSigner } from '../ports/token-signer'
import type { UseCase } from '../ports/use-case'
import { SessionIssuer, type SessionTokens } from './issue-session'

export interface SignInInput {
  readonly email: string
  readonly password: string
  /** Opaque per-caller key — an IP, or a hash of one. Used for rate limiting. */
  readonly callerKey: string
}

/**
 * Either a session, or proof that the password was right and a code is owed.
 *
 * A discriminated union rather than a nullable token, so a caller cannot
 * accidentally treat "needs a second factor" as "signed in" by reading a field
 * that happens to be populated.
 */
export type SignInOutcome =
  | { readonly kind: 'signed-in'; readonly tokens: SessionTokens }
  | { readonly kind: 'second-factor-required'; readonly challengeToken: string }

export class SignInFailed extends Error {
  constructor() {
    // ONE message for every failure below: unknown email, wrong password,
    // provider-only account. Anything more specific is an oracle that tells a
    // stranger which addresses have accounts — and on a news site the account
    // list overlaps the source list.
    super('Those details did not match an account.')
    this.name = 'SignInFailed'
  }
}

export class TooManyAttempts extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many sign-in attempts. Please wait and try again.')
    this.name = 'TooManyAttempts'
  }
}

export interface SignInDeps {
  readonly credentials: CredentialRepository
  readonly passwords: PasswordHasher
  readonly tokens: TokenSigner
  readonly sessions: SessionIssuer
  readonly limiter: RateLimiter
  readonly clock: ClockPort
}

/**
 * Five attempts a minute per caller.
 *
 * Low enough that online guessing is hopeless, high enough that a person
 * mistyping a passphrase twice is not locked out of their own newsroom.
 */
const ATTEMPT_RULE: RateLimitRule = { limit: 5, windowSeconds: 60 }

export class SignInWithPassword implements UseCase<SignInInput, SignInOutcome> {
  constructor(private readonly deps: SignInDeps) {}

  async execute(input: SignInInput): Promise<SignInOutcome> {
    await this.assertUnderLimit(input.callerKey)

    const credential = await this.findCredential(input.email)
    const verified = await this.verifyPassword(credential, input.password)

    if (!verified) throw new SignInFailed()

    if (credential.requiresSecondFactor) {
      return { kind: 'second-factor-required', challengeToken: await this.challenge(credential) }
    }

    return { kind: 'signed-in', tokens: await this.deps.sessions.issue(credential.userId) }
  }

  private async assertUnderLimit(callerKey: string): Promise<void> {
    const verdict = await this.deps.limiter.consume(`signin:${callerKey}`, ATTEMPT_RULE)

    if (!verdict.allowed) throw new TooManyAttempts(verdict.retryAfterSeconds)
  }

  /**
   * A malformed address is a failed sign-in, not a validation error.
   *
   * Telling a caller their input "is not an email" before checking anything
   * else is a free signal about which strings are worth trying.
   */
  private async findCredential(email: string): Promise<Credential> {
    let parsed: EmailAddress
    try {
      parsed = EmailAddress.of(email)
    } catch {
      throw new SignInFailed()
    }

    const found = await this.deps.credentials.findByEmail(parsed)
    if (found === null) throw new SignInFailed()

    return found
  }

  /**
   * Verifies, and upgrades the stored hash if its cost is behind today's.
   *
   * This is the only moment the plaintext exists, so it is the only moment a
   * rehash is possible. Skipping it means raising the cost protects nobody who
   * already has an account.
   */
  private async verifyPassword(credential: Credential, password: string): Promise<boolean> {
    const stored = credential.passwordHash

    // A provider-only account has no password. Answering "wrong password"
    // rather than "use Google" keeps the same single failure message.
    if (stored === null) return false

    const ok = await this.deps.passwords.verify(password, stored)
    if (!ok) return false

    if (this.deps.passwords.needsRehash(stored)) {
      const upgraded = await this.deps.passwords.hash(password)
      await this.deps.credentials.update(
        credential.setPassword(upgraded, this.deps.clock.now()),
      )
    }

    return true
  }

  /**
   * A challenge is bound to a NEW session id, which the second-factor step
   * carries through. The session therefore exists as an idea before it exists
   * as a token, and a challenge cannot be redeemed into somebody else's family.
   */
  private async challenge(credential: Credential): Promise<string> {
    return this.deps.tokens.sign(
      claimsFor({
        userId: credential.userId as UserId,
        sessionId: `pending:${credential.userId}`,
        kind: 'challenge',
        now: this.deps.clock.now(),
      }),
    )
  }
}
