import {
  Credential,
  EmailAddress,
  assertAcceptablePassword,
  userId as toUserId,
} from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import { EmailAlreadyRegistered, type CredentialRepository } from '../ports/credential-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { RateLimitRule, RateLimiter } from '../ports/rate-limit'
import type { UseCase } from '../ports/use-case'

export interface RegisterInput {
  readonly email: string
  readonly password: string
  readonly callerKey: string
}

/**
 * Deliberately says nothing about whether the address was new.
 *
 * A sign-up form that answers "already registered" is an account-existence
 * oracle anyone can query. On a news site that list overlaps the source list,
 * so the same neutral result is returned either way and the truth is delivered
 * by email — to the address in question, which is the only party entitled to it.
 */
export interface RegisterResult {
  readonly accepted: true
}

export interface RegisterDeps {
  readonly credentials: CredentialRepository
  readonly passwords: PasswordHasher
  readonly limiter: RateLimiter
  readonly clock: ClockPort
  readonly ids: IdPort
}

/** Three a minute. Registration is rare; scripted enumeration is not. */
const RULE: RateLimitRule = { limit: 3, windowSeconds: 60 }

export class RegistrationThrottled extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many attempts. Please wait and try again.')
    this.name = 'RegistrationThrottled'
  }
}

export class RegisterUser implements UseCase<RegisterInput, RegisterResult> {
  constructor(private readonly deps: RegisterDeps) {}

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const verdict = await this.deps.limiter.consume(`register:${input.callerKey}`, RULE)
    if (!verdict.allowed) throw new RegistrationThrottled(verdict.retryAfterSeconds)

    // Validated BEFORE the existence check, and before hashing: a rejected
    // password must not cost a slow hash, and must not depend on whether the
    // address exists.
    const email = EmailAddress.of(input.email)
    assertAcceptablePassword(input.password, email.localPart)

    const now = this.deps.clock.now()
    const credential = Credential.register({
      userId: toUserId(this.deps.ids.next()),
      email,
      passwordHash: await this.deps.passwords.hash(input.password),
      now,
    })

    try {
      await this.deps.credentials.create(credential)
    } catch (error) {
      // The store's unique index is the arbiter, not a read-then-write here:
      // two concurrent sign-ups both see "free" and both insert. Swallowing it
      // keeps the response identical to a successful registration.
      if (!(error instanceof EmailAlreadyRegistered)) throw error
    }

    return { accepted: true }
  }
}
