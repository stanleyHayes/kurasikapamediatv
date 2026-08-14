import type { UserId } from '../shared/ids'
import type { EmailAddress } from './email-address'

/**
 * Everything about how one person proves who they are.
 *
 * Split from the `user` record on purpose. A user is a person the newsroom
 * knows about — a byline, a display name, a role assignment. A credential is
 * the machinery of proof, and it is the part that must never be handed to a
 * template, logged, or serialised into a read model. Keeping them apart means
 * `UserDirectory` can render the roles screen without a password hash ever
 * entering the same object.
 *
 * An account may authenticate by password, by an external provider, or both,
 * but never by neither — see `assertHasAWayIn`.
 */
export type ExternalProvider = 'google' | 'facebook' | 'apple'

export const EXTERNAL_PROVIDERS: readonly ExternalProvider[] = ['google', 'facebook', 'apple']

export interface ExternalIdentity {
  readonly provider: ExternalProvider
  /** The provider's immutable subject id. NEVER the email — those change. */
  readonly subject: string
  readonly linkedAt: Date
}

export interface TotpEnrolment {
  /** Base32 shared secret. Encrypted at rest by the adapter, never logged. */
  readonly secret: string
  /**
   * Highest time-step counter already accepted, so a code cannot be replayed
   * inside the drift window. Null until the first successful verification.
   */
  readonly lastUsedCounter: number | null
  /** SHA-256 of each unused recovery code. Consumed one at a time. */
  readonly recoveryCodeHashes: readonly string[]
  readonly enrolledAt: Date
}

export interface CredentialProps {
  readonly userId: UserId
  readonly email: EmailAddress
  /** Null for an account that only ever signed in with a provider. */
  readonly passwordHash: string | null
  readonly externals: readonly ExternalIdentity[]
  readonly totp: TotpEnrolment | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class NoWayToSignIn extends Error {
  constructor() {
    super('An account must keep at least one way to sign in')
    this.name = 'NoWayToSignIn'
  }
}

export class ProviderAlreadyLinked extends Error {
  constructor(readonly provider: ExternalProvider) {
    super(`This account already has a ${provider} identity linked`)
    this.name = 'ProviderAlreadyLinked'
  }
}

export class TotpNotEnrolled extends Error {
  constructor() {
    super('Two-factor authentication is not enabled on this account')
    this.name = 'TotpNotEnrolled'
  }
}

export class TotpAlreadyEnrolled extends Error {
  constructor() {
    super('Two-factor authentication is already enabled on this account')
    this.name = 'TotpAlreadyEnrolled'
  }
}

export class Credential {
  private constructor(private readonly props: CredentialProps) {}

  static reconstitute(props: CredentialProps): Credential {
    return new Credential(props)
  }

  /** A new account created with a password. */
  static register(input: {
    readonly userId: UserId
    readonly email: EmailAddress
    readonly passwordHash: string
    readonly now: Date
  }): Credential {
    return new Credential({
      userId: input.userId,
      email: input.email,
      passwordHash: input.passwordHash,
      externals: [],
      totp: null,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  /**
   * A new account created by signing in with a provider for the first time.
   *
   * No password is set, and none is invented. An account with a password
   * nobody chose is an account with a password nobody can change.
   */
  static fromExternal(input: {
    readonly userId: UserId
    readonly email: EmailAddress
    readonly provider: ExternalProvider
    readonly subject: string
    readonly now: Date
  }): Credential {
    return new Credential({
      userId: input.userId,
      email: input.email,
      passwordHash: null,
      externals: [{ provider: input.provider, subject: input.subject, linkedAt: input.now }],
      totp: null,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  get userId(): UserId {
    return this.props.userId
  }

  get email(): EmailAddress {
    return this.props.email
  }

  get passwordHash(): string | null {
    return this.props.passwordHash
  }

  get hasPassword(): boolean {
    return this.props.passwordHash !== null
  }

  get totp(): TotpEnrolment | null {
    return this.props.totp
  }

  get requiresSecondFactor(): boolean {
    return this.props.totp !== null
  }

  get externals(): readonly ExternalIdentity[] {
    return this.props.externals
  }

  externalFor(provider: ExternalProvider): ExternalIdentity | null {
    return this.props.externals.find((e) => e.provider === provider) ?? null
  }

  snapshot(): CredentialProps {
    return this.props
  }

  /**
   * Links a provider to an existing account.
   *
   * One identity per provider. Two Google identities on one account has no
   * meaning, and silently replacing the first would let whoever controls the
   * second take the account over.
   */
  linkExternal(provider: ExternalProvider, subject: string, now: Date): Credential {
    if (this.externalFor(provider) !== null) throw new ProviderAlreadyLinked(provider)

    return this.with({
      externals: [...this.props.externals, { provider, subject, linkedAt: now }],
      updatedAt: now,
    })
  }

  unlinkExternal(provider: ExternalProvider, now: Date): Credential {
    const remaining = this.props.externals.filter((e) => e.provider !== provider)
    const next = this.with({ externals: remaining, updatedAt: now })

    next.assertHasAWayIn()

    return next
  }

  setPassword(passwordHash: string, now: Date): Credential {
    return this.with({ passwordHash, updatedAt: now })
  }

  removePassword(now: Date): Credential {
    const next = this.with({ passwordHash: null, updatedAt: now })

    next.assertHasAWayIn()

    return next
  }

  enrolTotp(secret: string, recoveryCodeHashes: readonly string[], now: Date): Credential {
    if (this.props.totp !== null) throw new TotpAlreadyEnrolled()

    return this.with({
      totp: { secret, lastUsedCounter: null, recoveryCodeHashes, enrolledAt: now },
      updatedAt: now,
    })
  }

  /** Records the step a code was accepted at, so it cannot be replayed. */
  recordTotpUse(counter: number, now: Date): Credential {
    const totp = this.props.totp
    if (totp === null) throw new TotpNotEnrolled()

    return this.with({ totp: { ...totp, lastUsedCounter: counter }, updatedAt: now })
  }

  /** Burns one recovery code. They are single use, by definition. */
  consumeRecoveryCode(hash: string, now: Date): Credential {
    const totp = this.props.totp
    if (totp === null) throw new TotpNotEnrolled()

    return this.with({
      totp: { ...totp, recoveryCodeHashes: totp.recoveryCodeHashes.filter((h) => h !== hash) },
      updatedAt: now,
    })
  }

  disableTotp(now: Date): Credential {
    if (this.props.totp === null) throw new TotpNotEnrolled()

    return this.with({ totp: null, updatedAt: now })
  }

  /**
   * The invariant that keeps an account reachable.
   *
   * Removing the last password or unlinking the last provider would leave an
   * account nobody can enter and only an operator can fix. Refusing is kinder
   * than a support ticket.
   */
  assertHasAWayIn(): void {
    if (!this.hasPassword && this.props.externals.length === 0) throw new NoWayToSignIn()
  }

  private with(changes: Partial<CredentialProps>): Credential {
    return new Credential({ ...this.props, ...changes })
  }
}
