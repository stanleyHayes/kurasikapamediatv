'use server'

import { ROLES } from '@kurasikapa/domain'
import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { invitationGraph } from '@kurasikapa/web-kit/composition/invitation-graph'

const inviteSchema = z.object({ email: z.email(), name: z.string().trim().max(120), roles: z.array(z.enum(ROLES)).min(1) })

export async function invitePersonAction(input: unknown): Promise<ActionResult<{ id: string; inviteUrl: string; emailSent: boolean }>> {
  return attempt(async () => {
    const parsed = inviteSchema.parse(input)
    const result = await invitationGraph().invite.execute({ actor: await requireActor(), ...parsed })
    return { id: result.invitation.id, inviteUrl: result.inviteUrl, emailSent: result.emailSent }
  })
}

export async function revokeInvitationAction(id: string): Promise<ActionResult<{ revoked: true }>> {
  return attempt(async () => { await invitationGraph().revoke.execute({ actor: await requireActor(), id }); return { revoked: true } })
}

export async function resendInvitationAction(id: string): Promise<ActionResult<{ inviteUrl: string; emailSent: boolean }>> {
  return attempt(async () => invitationGraph().resend.execute({ actor: await requireActor(), id }))
}
