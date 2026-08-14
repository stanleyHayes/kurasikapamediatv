import type { Credential, EmailAddress, ExternalProvider, UserId } from '@kurasikapa/domain'

/**
 * Where credentials live.
 *
 * Separate from `UserDirectory` on purpose, and not merely for tidiness: the
 * directory is read by the roles screen, and nothing that renders a screen
 * should be able to reach a password hash. Two ports, two shapes, and the
 * compiler keeps them apart.
 */
export class EmailAlreadyRegistered extends Error {
  constructor(readonly email: string) {
    // Deliberately NOT surfaced to an anonymous sign-up form — see the
    // RegisterUser use case, which turns this into the same neutral response
    // as a successful registration. Enumerating who has an account is a
    // privacy leak on a news site, where the account list is the source list.
    super(`${email} is already registered`)
    this.name = 'EmailAlreadyRegistered'
  }
}

export interface CredentialRepository {
  findByEmail(email: EmailAddress): Promise<Credential | null>

  findByUserId(userId: UserId): Promise<Credential | null>

  /**
   * Looks up by the provider's immutable subject, never by the email it
   * reported. Providers reassign and re-verify addresses; the subject is the
   * only stable join, and keying on email is how one person signs into
   * another's account.
   */
  findByExternal(provider: ExternalProvider, subject: string): Promise<Credential | null>

  /**
   * Inserts a new credential, failing if the email is taken.
   *
   * The uniqueness check must be an index in the store, not a read-then-write
   * in the use case: two concurrent sign-ups both see "not taken" and both
   * insert. THROWS `EmailAlreadyRegistered`.
   */
  create(credential: Credential): Promise<void>

  update(credential: Credential): Promise<void>
}
