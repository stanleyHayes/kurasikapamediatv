import type { ArticleId, RevisionId, UserId } from '@kurasikapa/domain'
import type { DomainEvent } from '../ports/ambient.js'

/** Who did what to which article, and when. Every editorial event carries it. */
export interface Occurrence {
  readonly articleId: ArticleId
  readonly actorId: UserId
  readonly occurredAt: Date
}

interface ArticleEvent extends DomainEvent, Occurrence {}

export interface DraftCreated extends ArticleEvent {
  readonly name: 'article.draft_created'
}
export interface ArticleSubmitted extends ArticleEvent {
  readonly name: 'article.submitted'
}
export interface ArticleRejected extends ArticleEvent {
  readonly name: 'article.rejected'
  /** Shown to the author, and retained in the audit log. */
  readonly note: string
}
export interface ArticleUnpublished extends ArticleEvent {
  readonly name: 'article.unpublished'
  /** Why it was pulled. Corrections must stay traceable. */
  readonly reason: string
}
export interface ArticleApproved extends ArticleEvent {
  readonly name: 'article.approved'
  readonly revisionId: RevisionId
}
export interface ArticleScheduled extends ArticleEvent {
  readonly name: 'article.scheduled'
  readonly scheduledAt: Date
}
export interface ArticlePublished extends ArticleEvent {
  readonly name: 'article.published'
  readonly slug: string
  readonly locale: string
}

export const draftCreated = (at: Occurrence): DraftCreated => ({
  name: 'article.draft_created',
  ...at,
})

export const articleSubmitted = (at: Occurrence): ArticleSubmitted => ({
  name: 'article.submitted',
  ...at,
})

export const articleRejected = (at: Occurrence, note: string): ArticleRejected => ({
  name: 'article.rejected',
  ...at,
  note,
})

export const articleUnpublished = (at: Occurrence, reason: string): ArticleUnpublished => ({
  name: 'article.unpublished',
  ...at,
  reason,
})

export const articleApproved = (at: Occurrence, revisionId: RevisionId): ArticleApproved => ({
  name: 'article.approved',
  ...at,
  revisionId,
})

export const articleScheduled = (at: Occurrence, scheduledAt: Date): ArticleScheduled => ({
  name: 'article.scheduled',
  ...at,
  scheduledAt,
})

/**
 * Carries the slug and locale so the cache-invalidation subscriber can call
 * `updateTag` without a second read. Breaking news must be live within the
 * request that publishes it.
 */
export const articlePublished = (
  at: Occurrence,
  slug: string,
  locale: string,
): ArticlePublished => ({ name: 'article.published', ...at, slug, locale })
