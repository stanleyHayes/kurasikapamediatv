'use server'

import type { ArticleId } from '@kurasikapa/domain'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { RateLimited, callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import { bookmarkSchema, parseInput, postCommentSchema } from '@kurasikapa/web-kit/actions/schemas'

/**
 * Reader-side actions: saving, liking and commenting.
 *
 * These belong to the public app because a reader performs them. The newsroom
 * counterparts — moderation, role assignment, social scheduling — live in
 * apps/studio, so a deployment of one never carries the other's surface.
 */

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

export async function toggleLikeAction(
  input: unknown,
  liked: boolean,
): Promise<ActionResult<{ liked: boolean; count: number }>> {
  return attempt(async () => {
    const { articleId } = parseInput(bookmarkSchema, input)
    const actor = await requireActor()
    const graph = container()
    const target = articleId as ArticleId

    const verdict = await limit(graph.rateLimiter, await callerKey(actor.id), 'likes', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return liked
      ? graph.unlikeArticle.execute({ actor, articleId: target })
      : graph.likeArticle.execute({ actor, articleId: target })
  })
}

export async function postCommentAction(
  input: unknown,
): Promise<ActionResult<{ id: string; state: string }>> {
  return attempt(async () => {
    const parsed = parseInput(postCommentSchema, input)
    const actor = await requireActor()
    const graph = container()

    const verdict = await limit(graph.rateLimiter, await callerKey(actor.id), 'comments', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.postComment.execute({
      actor,
      articleId: parsed.articleId as ArticleId,
      body: parsed.body,
    })
  })
}
