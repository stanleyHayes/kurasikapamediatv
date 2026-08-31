import { requirePermission, type Actor } from '@kurasikapa/domain'
import type { InvitationRepository } from '../ports/invitation-repository'

export class RevokeInvitation {
  constructor(private readonly invitations: InvitationRepository) {}
  async execute(input: { readonly actor: Actor; readonly id: string }): Promise<void> {
    requirePermission(input.actor, 'role:assign')
    const invitation = (await this.invitations.list()).find((item) => item.id === input.id)
    if (invitation?.state !== 'pending') return
    await this.invitations.replace({ ...invitation, state: 'revoked' })
  }
}
