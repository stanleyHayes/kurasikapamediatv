'use server'

import type { CommentId, UserId } from '@kurasikapa/domain'
import { restoreRevision } from '@kurasikapa/web-kit/bff/restore-revision'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import {
  assignRolesSchema,
  moderateCommentSchema,
  parseInput,
  restoreRevisionSchema,
} from '@kurasikapa/web-kit/actions/schemas'

/**
 * Newsroom-side actions: moderation, role assignment and revision restore.
 *
 * Split out of the old `side-actions.ts` when the studio became its own
 * deployment (ADR-0011). Reader actions — saving, liking, commenting — stayed
 * in apps/web as `reader-actions.ts`. The seam is who performs the action, not
 * which use case it calls.
 *
 * Social scheduling and caption proposals live in `social.ts` next door, which
 * owns the per-platform schema they need.
 */

export async function assignRolesAction(
  input: unknown,
): Promise<ActionResult<{ roles: readonly string[] }>> {
  return attempt(async () => {
    const parsed = parseInput(assignRolesSchema, input)
    const actor = await requireActor()

    const result = await container().assignRoles.execute({
      actor,
      targetUserId: parsed.targetUserId as UserId,
      // Left as strings: the domain decides what counts as a role, refuses
      // self-assignment, and refuses anything it does not recognise.
      roles: parsed.roles,
    })

    return { roles: result.roles }
  })
}

/**
 * Brings an older version's text back as the current one.
 *
 * The domain writes it FORWARD as a new revision rather than rewinding.
 */
export async function restoreRevisionAction(
  input: unknown,
): Promise<ActionResult<{ seq: number }>> {
  return attempt(async () => {
    const parsed = parseInput(restoreRevisionSchema, input)
    const actor = await requireActor()

    return restoreRevision(actor, parsed, (args) => container().restoreRevision.execute(args))
  })
}

export async function moderateCommentAction(
  input: unknown,
): Promise<ActionResult<{ state: string }>> {
  return attempt(async () => {
    const parsed = parseInput(moderateCommentSchema, input)
    const actor = await requireActor()

    return container().moderateComment.execute({
      actor,
      commentId: parsed.commentId as CommentId,
      decision: parsed.decision,
    })
  })
}
