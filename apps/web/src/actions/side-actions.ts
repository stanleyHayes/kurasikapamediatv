'use server'

import type { ArticleId, UserId } from '@kurasikapa/domain'
import { restoreRevision } from '../bff/restore-revision'
import { requireActor } from '../composition/actor'
import { container } from '../composition/container'
import { type ActionResult, attempt } from './result'
import {
  assignRolesSchema,
  bookmarkSchema,
  parseInput,
  queueSocialPostSchema,
  restoreRevisionSchema,
} from './schemas'

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
 * Saving is a reader action. Any signed-in reader may save; the use case
 * scopes to `actor.id`, so one reader's list never leaks into another's.
 */
export async function toggleSavedAction(
  input: unknown,
  saved: boolean,
): Promise<ActionResult<{ saved: boolean }>> {
  return attempt(async () => {
    const { articleId } = parseInput(bookmarkSchema, input)
    const actor = await requireActor()
    const target = articleId as ArticleId

    const result = saved
      ? await container().removeSavedArticle.execute({ actor, articleId: target })
      : await container().saveArticle.execute({ actor, articleId: target })

    return { saved: result.saved }
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

    return restoreRevision(actor, parsed, (args) =>
      container().restoreRevision.execute(args),
    )
  })
}
