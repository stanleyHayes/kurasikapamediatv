'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { invitationGraph } from '@kurasikapa/web-kit/composition/invitation-graph'

const schema = z.object({ token: z.string().min(20).max(300), password: z.string().min(1).max(256) })

export async function acceptInvitationAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return attempt(async () => invitationGraph().accept.execute(schema.parse(input)))
}
