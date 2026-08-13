'use server'

import type { ArticleId, CommentId, UserId } from '@kurasikapa/domain'
import type { SocialCaption } from '@kurasikapa/application'
import { restoreRevision } from '@kurasikapa/web-kit/bff/restore-revision'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { RateLimited, callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import {
  assignRolesSchema,
  moderateCommentSchema,
  parseInput,
  proposeSocialCaptionSchema,
  queueSocialPostSchema,
  restoreRevisionSchema,
} from '@kurasikapa/web-kit/actions/schemas'

/**
 * Newsroom-side actions: moderation, role assignment, social scheduling and
 * revision restore.
 *
 * Split out of the old `side-actions.ts` when the studio became its own
 * deployment. Reader actions — saving, liking, commenting — stayed in
 * apps/web. The seam is who performs the action, not which use case it calls.
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
 * Queues a published article to the social platforms.
 *
 * One post per platform, all validated before any is written — the use case
 * refuses the whole request rather than leaving half a fan-out queued.
 */
export async function queueSocialPostAction(
  input: unknown,
): Promise<ActionResult<{ queued: number }>> {
  return attempt(async () => {
    const parsed = parseInput(queueSocialPostSchema, input)
    const actor = await requireActor()

    const result = await container().queueSocialPost.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      platforms: parsed.platforms,
      caption: parsed.caption,
      scheduledAt: new Date(parsed.scheduledAt),
    })

    return { queued: result.queued.length }
  })
}

/**
 * AI caption proposal for the compose form. Persists nothing — the editor
 * must still paste into the caption field and schedule.
 */
export async function proposeSocialCaptionAction(
  input: unknown,
): Promise<ActionResult<SocialCaption>> {
  return attempt(async () => {
    const parsed = parseInput(proposeSocialCaptionSchema, input)
    const actor = await requireActor()
    const verdict = await limit(container().rateLimiter, await callerKey(actor.id), 'ai', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return container().proposeSocialCaption.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      platform: parsed.platform,
    })
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
