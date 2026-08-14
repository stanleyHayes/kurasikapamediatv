import {
  Credential,
  EmailAddress,
  userId as toUserId,
  type ExternalProvider,
} from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { CredentialRepository } from '../ports/credential-repository'
import type { ExternalUser } from '../ports/oauth-provider'
import type { UseCase } from '../ports/use-case'
import type { SessionIssuer, SessionTokens } from './issue-session'

export interface ProviderSignInInput {
  /** Already verified by the adapter — signature, issuer, audience, nonce. */
  readonly external: ExternalUser
}

export class ProviderAccountUnusable extends Error {
  constructor(readonly provider: ExternalProvider) {
    super(
      `Your ${provider} account did not provide a verified email address, so we cannot sign you in with it. Please sign in with your email and password instead.`,
    )
    this.name = 'ProviderAccountUnusable'
  }
}

export interface ProviderSignInDeps {
  readonly credentials: CredentialRepository
  readonly sessions: SessionIssuer
  readonly clock: ClockPort
  readonly ids: IdPort
}

/**
 * Signs someone in with Google, Facebook or Apple.
 *
 * Three cases, and the middle one is where this goes wrong if it is written
 * carelessly:
 *
 * 1. **Known subject.** We have seen this provider identity before. Sign in.
 *
 * 2. **Unknown subject, known email.** Somebody is signing in with a provider
 *    for the first time on an address that already has an account. Linking is
 *    the behaviour people expect — and it is also, done wrong, one-step account
 *    takeover: register a provider account claiming an editor's address, sign
 *    in, inherit their roles.
 *
 *    The control is `emailVerified`. We link ONLY when the provider states it
 *    verified the address itself. Facebook can return an unverified address;
 *    Apple returns relay addresses. An unverified email is treated as no email.
 *
 * 3. **Unknown subject, unknown email.** A new reader. Create the account with
 *    no password — see `Credential.fromExternal` for why none is invented.
 */
export class SignInWithProvider implements UseCase<ProviderSignInInput, SessionTokens> {
  constructor(private readonly deps: ProviderSignInDeps) {}

  async execute(input: ProviderSignInInput): Promise<SessionTokens> {
    const { external } = input

    const known = await this.deps.credentials.findByExternal(external.provider, external.subject)
    if (known !== null) return this.deps.sessions.issue(known.userId)

    const email = this.usableEmail(external)
    const existing = await this.deps.credentials.findByEmail(email)

    if (existing === null) {
      // Nobody to impersonate. An unverified address is acceptable here — the
      // account being created IS the provider identity, and the address is
      // only a way to reach them.
      const created = await this.createFrom(external, email)

      return this.deps.sessions.issue(created.userId)
    }

    // An account already exists on this address, so linking would hand the
    // provider identity somebody else's roles. ONLY a provider-asserted
    // verification is enough to believe they are the same person. Facebook
    // never asserts it, so this is the branch that refuses Facebook sign-in
    // onto an existing account — deliberately.
    if (!external.emailVerified) throw new ProviderAccountUnusable(external.provider)

    const linked = await this.link(existing, external)

    return this.deps.sessions.issue(linked.userId)
  }

  /**
   * An address we can actually use, verified or not.
   *
   * A provider that returns no address at all is refused: an account needs a
   * way to be contacted and a way to recover, and inventing one — the
   * `{id}@facebook.com` pattern — creates an account keyed to a mailbox nobody
   * owns and nobody can receive a reset at.
   */
  private usableEmail(external: ExternalUser): EmailAddress {
    if (external.email === null) throw new ProviderAccountUnusable(external.provider)

    try {
      return EmailAddress.of(external.email)
    } catch {
      throw new ProviderAccountUnusable(external.provider)
    }
  }

  private async createFrom(external: ExternalUser, email: EmailAddress): Promise<Credential> {
    const credential = Credential.fromExternal({
      userId: toUserId(this.deps.ids.next()),
      email,
      provider: external.provider,
      subject: external.subject,
      now: this.deps.clock.now(),
    })

    await this.deps.credentials.create(credential)

    return credential
  }

  private async link(existing: Credential, external: ExternalUser): Promise<Credential> {
    // Already linked to a DIFFERENT subject for this provider: two provider
    // accounts claiming one address. The domain refuses; we do not silently
    // repoint the link, which is the takeover this whole method guards.
    const linked = existing.linkExternal(
      external.provider,
      external.subject,
      this.deps.clock.now(),
    )

    await this.deps.credentials.update(linked)

    return linked
  }
}
