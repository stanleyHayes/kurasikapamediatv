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

    const email = this.verifiedEmail(external)
    const existing = await this.deps.credentials.findByEmail(email)

    const credential =
      existing === null ? await this.createFrom(external, email) : await this.link(existing, external)

    return this.deps.sessions.issue(credential.userId)
  }

  /**
   * An unverified address is refused outright rather than used to create a
   * fresh account, because the account it creates would claim an address its
   * owner never confirmed — and the real owner could never then register.
   */
  private verifiedEmail(external: ExternalUser): EmailAddress {
    if (external.email === null || !external.emailVerified) {
      throw new ProviderAccountUnusable(external.provider)
    }

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
