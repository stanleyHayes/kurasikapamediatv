import { Credential, EmailAddress, assertAcceptablePassword, userId } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { CredentialRepository } from '../ports/credential-repository'
import type { InvitationRepository } from '../ports/invitation-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { RoleRepository } from '../ports/role-repository'
import type { SecretGenerator } from '../ports/totp'
import type { UserDirectory } from '../ports/user-directory'

export class InvitationUnusable extends Error { constructor() { super('This invitation is invalid, expired, or has already been used.'); this.name = 'InvitationUnusable' } }

export class AcceptInvitation {
  constructor(private readonly deps: { invitations: InvitationRepository; credentials: CredentialRepository; users: UserDirectory; roles: RoleRepository; passwords: PasswordHasher; secrets: SecretGenerator; clock: ClockPort; ids: IdPort }) {}

  async execute(input: { readonly token: string; readonly password: string }): Promise<{ readonly email: string }> {
    const found = await this.deps.invitations.findByTokenHash(this.deps.secrets.sha256(input.token))
    const now = this.deps.clock.now()
    if (found?.state !== 'pending' || now.getTime() >= found.expiresAt.getTime()) throw new InvitationUnusable()
    const email = EmailAddress.of(found.email)
    assertAcceptablePassword(input.password, email.localPart)
    const id = userId(this.deps.ids.next())
    const credential = Credential.register({ userId: id, email, passwordHash: await this.deps.passwords.hash(input.password), now })
    await this.deps.credentials.create(credential)
    await this.deps.users.create({ id, email: found.email, name: found.name === '' ? email.localPart : found.name })
    await this.deps.roles.replace(id, found.roles)
    await this.deps.invitations.replace({ ...found, state: 'accepted' })
    return { email: found.email }
  }
}
