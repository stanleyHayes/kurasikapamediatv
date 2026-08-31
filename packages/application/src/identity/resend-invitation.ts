import { requirePermission, type Actor } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { EmailPort } from '../ports/email'
import type { InvitationRepository } from '../ports/invitation-repository'
import type { SecretGenerator } from '../ports/totp'
import { InvitationUnusable } from './accept-invitation'
import { sendInvite } from './invite-user'

export class ResendInvitation {
  constructor(private readonly deps: { invitations: InvitationRepository; email: EmailPort; secrets: SecretGenerator; clock: ClockPort; siteUrl: string }) {}
  async execute(input: { readonly actor: Actor; readonly id: string }): Promise<{ inviteUrl: string; emailSent: boolean }> {
    requirePermission(input.actor, 'role:assign')
    const found = (await this.deps.invitations.list()).find((item) => item.id === input.id)
    if (found?.state !== 'pending') throw new InvitationUnusable()
    const token = this.deps.secrets.token(32)
    // eslint-disable-next-line no-restricted-globals
    const expiresAt = new Date(this.deps.clock.now().getTime() + 7 * 24 * 60 * 60 * 1_000)
    const updated = { ...found, tokenHash: this.deps.secrets.sha256(token), expiresAt }
    await this.deps.invitations.replace(updated)
    const inviteUrl = `${this.deps.siteUrl}/en/accept-invite?token=${encodeURIComponent(token)}`
    return { inviteUrl, emailSent: await sendInvite(this.deps.email, updated, inviteUrl) }
  }
}
