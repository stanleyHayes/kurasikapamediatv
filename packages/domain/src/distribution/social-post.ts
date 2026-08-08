import type { Article } from '../editorial/article'
import { isPubliclyVisible } from '../editorial/article-status'
import type { ArticleId, Branded, UserId } from '../shared/ids'

export type SocialPostId = Branded<'SocialPostId'>
export const socialPostId = (v: string): SocialPostId => v as SocialPostId

/** Confirmed in the questionnaire (§ 10). The rest are adapters, not redesigns. */
export const PLATFORMS = ['facebook', 'instagram'] as const
export type Platform = (typeof PLATFORMS)[number]

export const POST_STATES = ['queued', 'sent', 'failed'] as const
export type PostState = (typeof POST_STATES)[number]

export interface SocialPostProps {
  readonly id: SocialPostId
  readonly articleId: ArticleId
  readonly platform: Platform
  readonly caption: string
  readonly scheduledAt: Date
  readonly state: PostState
  readonly attempts: number
  readonly lastError: string | null
  readonly createdBy: UserId
}

export class ArticleNotLive extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} is not published and cannot be posted`)
    this.name = 'ArticleNotLive'
  }
}

export class SchedulePostInPast extends Error {
  constructor(readonly at: Date) {
    super(`Cannot schedule a post for ${at.toISOString()} — that is in the past`)
    this.name = 'SchedulePostInPast'
  }
}

export class EmptyCaption extends Error {
  constructor() {
    super('A social post needs a caption')
    this.name = 'EmptyCaption'
  }
}

export class AlreadySent extends Error {
  constructor(readonly id: SocialPostId) {
    super(`Post ${id} has already been sent`)
    this.name = 'AlreadySent'
  }
}

/** Beyond this, a failure is not transient and a person should look. */
const MAX_ATTEMPTS = 5

export interface NewSocialPost {
  readonly id: SocialPostId
  readonly platform: Platform
  readonly caption: string
  readonly scheduledAt: Date
}

/**
 * One outbound post about one article.
 *
 * The rule that matters: a post may only reference a **published** article.
 * Social reach is the one place a mistake cannot be taken back — an unpublished
 * story announced to Facebook is public whatever the site says afterwards.
 */
export class SocialPost {
  private constructor(private readonly props: SocialPostProps) {}

  static reconstitute(props: SocialPostProps): SocialPost {
    return new SocialPost(props)
  }

  static queue(input: NewSocialPost, article: Article, by: UserId, now: Date): SocialPost {
    if (!isPubliclyVisible(article.status)) throw new ArticleNotLive(article.id)
    if (input.caption.trim() === '') throw new EmptyCaption()
    if (input.scheduledAt.getTime() < now.getTime()) throw new SchedulePostInPast(input.scheduledAt)

    return new SocialPost({
      ...input,
      caption: input.caption.trim(),
      articleId: article.id,
      state: 'queued',
      attempts: 0,
      lastError: null,
      createdBy: by,
    })
  }

  get id(): SocialPostId { return this.props.id }
  get articleId(): ArticleId { return this.props.articleId }
  get platform(): Platform { return this.props.platform }
  get caption(): string { return this.props.caption }
  get state(): PostState { return this.props.state }
  get attempts(): number { return this.props.attempts }
  get scheduledAt(): Date { return this.props.scheduledAt }

  isDue(now: Date): boolean {
    return this.props.state === 'queued' && this.props.scheduledAt.getTime() <= now.getTime()
  }

  markSent(): SocialPost {
    if (this.props.state === 'sent') throw new AlreadySent(this.props.id)

    return this.with({ state: 'sent', attempts: this.props.attempts + 1, lastError: null })
  }

  /**
   * A failure returns to the queue until the attempt budget runs out.
   *
   * Retrying forever turns one bad post into a permanent load on someone
   * else's API; giving up after one turns a network blip into a story that
   * never reached anyone.
   */
  markFailed(reason: string): SocialPost {
    if (this.props.state === 'sent') throw new AlreadySent(this.props.id)

    const attempts = this.props.attempts + 1

    return this.with({
      state: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
      attempts,
      lastError: reason,
    })
  }

  /** True once it has stopped retrying and needs a person. */
  needsAttention(): boolean {
    return this.props.state === 'failed'
  }

  private with(patch: Partial<SocialPostProps>): SocialPost {
    return new SocialPost({ ...this.props, ...patch })
  }

  snapshot(): SocialPostProps {
    return this.props
  }
}
