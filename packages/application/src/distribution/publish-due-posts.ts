import type { SocialPostId } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { SocialPostRepository, SocialPublishPort } from '../ports/social'
import type { UseCase } from '../ports/use-case'

export interface PublishDuePostsDeps {
  readonly posts: SocialPostRepository
  readonly social: SocialPublishPort
  readonly clock: ClockPort
  /** Absolute site URL — the link leaves our domain, so it cannot be relative. */
  readonly siteUrl: string
}

export interface PublishDuePostsResult {
  readonly sent: readonly SocialPostId[]
  readonly retrying: readonly SocialPostId[]
  readonly abandoned: readonly SocialPostId[]
}

/**
 * The social fan-out worker.
 *
 * Failures are per-post, never per-batch: one expired Instagram token must not
 * stop the Facebook queue. Each outcome is reported separately so the caller
 * can alert on `abandoned` — a post that quietly stopped retrying is a story
 * the newsroom believes went out and did not.
 */
export class PublishDuePosts implements UseCase<Record<string, never>, PublishDuePostsResult> {
  constructor(private readonly deps: PublishDuePostsDeps) {}

  async execute(): Promise<PublishDuePostsResult> {
    const now = this.deps.clock.now()
    const due = await this.deps.posts.listDue(now)

    const sent: SocialPostId[] = []
    const retrying: SocialPostId[] = []
    const abandoned: SocialPostId[] = []

    for (const post of due) {
      try {
        await this.deps.social.publish({
          platform: post.platform,
          caption: post.caption,
          url: `${this.deps.siteUrl}/articles/${post.articleId}`,
        })

        await this.deps.posts.save(post.markSent())
        sent.push(post.id)
      } catch (error) {
        const failed = post.markFailed(describe(error))
        await this.deps.posts.save(failed)

        if (failed.needsAttention()) abandoned.push(post.id)
        else retrying.push(post.id)
      }
    }

    return { sent, retrying, abandoned }
  }
}

const describe = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)
