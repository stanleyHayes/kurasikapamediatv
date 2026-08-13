import {
  type Actor,
  type ArticleId,
  type Platform,
  type PlatformCaptions,
  SocialPost,
  type SocialPostId,
  captionForPlatform,
  requirePermission,
  socialPostId,
} from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { SocialPostRepository } from '../ports/social'
import type { UseCase } from '../ports/use-case'

export interface QueueSocialPostDeps {
  readonly posts: SocialPostRepository
  readonly articles: ArticleRepository
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface QueueSocialPostInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly platforms: readonly Platform[]
  readonly caption: string
  /** Per-platform overrides; a platform without one gets the shared caption. */
  readonly captions?: PlatformCaptions | undefined
  readonly scheduledAt: Date
}

export interface QueueSocialPostResult {
  readonly queued: readonly SocialPostId[]
}

/**
 * Queues one post per platform for a published article.
 *
 * Each platform gets its own row and may carry its own caption; platforms
 * without an override share `caption` (the domain decides which applies).
 * A `scheduledAt` of right now is legitimate — "publish now" queues a post
 * whose moment has already arrived, and the fan-out worker picks it up on
 * its next pass.
 */
export class QueueSocialPost implements UseCase<QueueSocialPostInput, QueueSocialPostResult> {
  constructor(private readonly deps: QueueSocialPostDeps) {}

  async execute(input: QueueSocialPostInput): Promise<QueueSocialPostResult> {
    requirePermission(input.actor, 'social:publish')

    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const now = this.deps.clock.now()

    // Build every post BEFORE writing any of them. Validating and saving in
    // one loop would leave Facebook queued and Instagram refused, which is
    // the half-published state a newsroom then has to notice and unpick.
    const posts = input.platforms.map((platform) =>
      SocialPost.queue(
        {
          id: socialPostId(this.deps.ids.next()),
          platform,
          caption: captionForPlatform(platform, input.captions, input.caption),
          scheduledAt: input.scheduledAt,
        },
        article,
        input.actor.id,
        now,
      ),
    )

    for (const post of posts) await this.deps.posts.save(post)

    return { queued: posts.map((p) => p.id) }
  }
}
