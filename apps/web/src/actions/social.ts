'use server'

import type { ArticleId } from '@kurasikapa/domain'
import { ArticleNotFound, ProposeSocialSummary, type Summary } from '@kurasikapa/application'
import { z } from 'zod'
import { requireActor } from '../composition/actor'
import { container } from '../composition/container'
import { RateLimited, callerKey, limit } from '../security/rate-limit'
import { type ActionResult, attempt } from './result'
import { parseInput } from './schemas'

const platform = z.enum(['facebook', 'instagram'])

/**
 * Queueing a social post — the per-platform counterpart of the schema in
 * schemas.ts.
 *
 * `captions` carries only the platforms whose caption differs; a platform
 * without an entry gets the shared `caption` (the domain decides, the wire
 * just transports). `scheduledAt` accepts the literal "now" for publish-now:
 * the Date is minted here at the composition root, never below it.
 */
const queueSocialPostSchema = z.object({
  articleId: z.string().min(1),
  platforms: z.array(platform).min(1),
  caption: z.string().trim().min(1).max(2200),
  captions: z.record(platform, z.string().trim().min(1).max(2200)).optional(),
  scheduledAt: z.union([z.iso.datetime(), z.literal('now')]),
})

const proposeSocialSummarySchema = z.object({
  articleId: z.string().min(1),
  locale: z.string().trim().min(2).max(10),
})

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
      captions: parsed.captions,
      scheduledAt: parsed.scheduledAt === 'now' ? new Date() : new Date(parsed.scheduledAt),
    })

    return { queued: result.queued.length }
  })
}

/**
 * AI short summary for the compose form. Persists nothing — the editor must
 * still accept it into a caption and schedule (ADR-0005).
 *
 * The composer knows the article by id; the published-article lookup works by
 * slug. The id is resolved through the same published list the composer was
 * built from, so an id the composer could not have shown is simply not found.
 */
export async function proposeSocialSummaryAction(
  input: unknown,
): Promise<ActionResult<Summary>> {
  return attempt(async () => {
    const parsed = parseInput(proposeSocialSummarySchema, input)
    const actor = await requireActor()

    const verdict = await limit(container().rateLimiter, await callerKey(actor.id), 'ai', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    const page = await container().listPublishedArticles.execute({
      locale: parsed.locale,
      limit: 50,
    })
    const mine = page.items.find((article) => article.id === parsed.articleId)
    if (mine === undefined) throw new ArticleNotFound(parsed.articleId as ArticleId)

    return new ProposeSocialSummary({
      published: container().getPublishedArticle,
      ai: container().ai,
    }).execute({ actor, articleId: mine.id, slug: mine.slug.value, locale: mine.locale })
  })
}
