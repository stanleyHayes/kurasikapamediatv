import { assertAcceptablePassword, type Actor } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { CredentialRepository } from '../ports/credential-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { RefreshTokenRepository } from '../ports/refresh-token-repository'
import type { UseCase } from '../ports/use-case'

export interface ChangePasswordInput { readonly actor: Actor; readonly currentPassword: string; readonly newPassword: string }
export interface ChangePasswordDeps { readonly credentials: CredentialRepository; readonly passwords: PasswordHasher; readonly refreshTokens: RefreshTokenRepository; readonly clock: ClockPort }

export class PasswordChangeRejected extends Error {
  constructor() { super('The current password is incorrect.'); this.name = 'PasswordChangeRejected' }
}

export class ChangePassword implements UseCase<ChangePasswordInput, void> {
  constructor(private readonly deps: ChangePasswordDeps) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const credential = await this.deps.credentials.findByUserId(input.actor.id)
    if (credential?.passwordHash === null || credential === null) throw new PasswordChangeRejected()
    if (!(await this.deps.passwords.verify(input.currentPassword, credential.passwordHash))) throw new PasswordChangeRejected()
    assertAcceptablePassword(input.newPassword, credential.email.localPart)
    const changed = credential.setPassword(await this.deps.passwords.hash(input.newPassword), this.deps.clock.now())
    await this.deps.credentials.update(changed)
    await this.deps.refreshTokens.revokeAllForUser(input.actor.id)
  }
}
