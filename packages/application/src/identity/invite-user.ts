import { EmailAddress, assertMayAssignRoles, userId, type Actor } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { EmailPort } from '../ports/email'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'
import type { SecretGenerator } from '../ports/totp'

const TTL_MS = 7 * 24 * 60 * 60 * 1_000

export interface InviteUserInput { readonly actor: Actor; readonly email: string; readonly name: string; readonly roles: readonly string[] }
export interface InviteUserResult { readonly invitation: InvitationRecord; readonly inviteUrl: string; readonly emailSent: boolean }

export class InviteUser {
  constructor(private readonly deps: { invitations: InvitationRepository; email: EmailPort; secrets: SecretGenerator; clock: ClockPort; ids: IdPort; siteUrl: string }) {}

  async execute(input: InviteUserInput): Promise<InviteUserResult> {
    const email = EmailAddress.of(input.email).value
    const id = this.deps.ids.next()
    assertMayAssignRoles(input.actor, userId(id), input.roles)
    const token = this.deps.secrets.token(32)
    const now = this.deps.clock.now()
    // eslint-disable-next-line no-restricted-globals
    const expiresAt = new Date(now.getTime() + TTL_MS)
    const invitation: InvitationRecord = { id, email, name: input.name.trim(), roles: input.roles, tokenHash: this.deps.secrets.sha256(token), invitedBy: input.actor.id, createdAt: now, expiresAt, state: 'pending' }
    await this.deps.invitations.create(invitation)
    const inviteUrl = `${this.deps.siteUrl}/en/accept-invite?token=${encodeURIComponent(token)}`
    const emailSent = await sendInvite(this.deps.email, invitation, inviteUrl)
    return { invitation, inviteUrl, emailSent }
  }
}

export async function sendInvite(email: EmailPort, invitation: InvitationRecord, inviteUrl: string): Promise<boolean> {
  try {
    await email.send({ to: invitation.email, subject: 'You are invited to Kurasikapa Studio', text: `Hello ${invitation.name || 'there'},\n\nYou have been invited to Kurasikapa Studio as: ${invitation.roles.join(', ')}.\n\nSet your password and accept the invitation within 7 days:\n${inviteUrl}\n` })
    return true
  } catch { return false }
}
