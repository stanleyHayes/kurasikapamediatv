import { type Actor, requirePermission } from '../identity/actor.js'
import type { ArticleId, CategoryId, FamilyId, RevisionId, TagId, UserId } from '../shared/ids.js'
import type { Slug } from '../shared/slug.js'
import { type ArticleStatus, type Transition, isAllowedFrom, ruleFor } from './article-status.js'
import { IllegalTransition, MissingApprovedRevision, NotOwnArticle, ScheduleInPast } from './errors.js'

export interface ArticleProps {
  readonly id: ArticleId
  readonly familyId: FamilyId
  readonly locale: string
  readonly slug: Slug
  readonly title: string
  readonly authorId: UserId
  readonly categoryId: CategoryId
  readonly tagIds: readonly TagId[]
  readonly status: ArticleStatus
  readonly approvedRevisionId: RevisionId | null
  readonly scheduledAt: Date | null
  readonly publishedAt: Date | null
}

/**
 * One article, in one locale. A French article is a separate Article sharing a
 * `familyId` with the English one — it has its own slug, byline and publish
 * state, and may go live weeks apart. See docs/04-data-model.md § 1.
 *
 * Every transition returns a new Article. Nothing here mutates, and nothing here
 * reads the clock — the caller passes `now` so the rule is testable.
 */
export class Article {
  private constructor(private readonly props: ArticleProps) {}

  static reconstitute(props: ArticleProps): Article {
    return new Article(props)
  }

  get id(): ArticleId { return this.props.id }
  get familyId(): FamilyId { return this.props.familyId }
  get locale(): string { return this.props.locale }
  get slug(): Slug { return this.props.slug }
  get authorId(): UserId { return this.props.authorId }
  get status(): ArticleStatus { return this.props.status }
  get scheduledAt(): Date | null { return this.props.scheduledAt }
  get publishedAt(): Date | null { return this.props.publishedAt }

  submitForReview(actor: Actor): Article {
    return this.transition('submit', actor)
  }

  approve(actor: Actor, revisionId: RevisionId): Article {
    const next = this.transition('approve', actor)
    return next.with({ approvedRevisionId: revisionId })
  }

  reject(actor: Actor): Article {
    return this.transition('reject', actor).with({ approvedRevisionId: null })
  }

  schedule(actor: Actor, at: Date, now: Date): Article {
    if (at.getTime() <= now.getTime()) throw new ScheduleInPast(at)
    this.guardApprovedRevision()
    return this.transition('schedule', actor).with({ scheduledAt: at })
  }

  publish(actor: Actor, now: Date): Article {
    this.guardApprovedRevision()
    return this.transition('publish', actor).with({ publishedAt: now, scheduledAt: null })
  }

  unpublish(actor: Actor): Article {
    return this.transition('unpublish', actor)
  }

  /** True once the scheduled moment has arrived. Drives the publishing cron. */
  isDueForPublication(now: Date): boolean {
    const { status, scheduledAt } = this.props
    return status === 'scheduled' && scheduledAt !== null && scheduledAt.getTime() <= now.getTime()
  }

  /**
   * Guard order is deliberate: permission, then ownership, then state.
   *
   * "You may not do this at all" outranks "you may not do this to *this*
   * article" — and telling someone with no editorial permission that an
   * article "belongs to another author" leaks who wrote an unpublished draft.
   */
  private transition(transition: Transition, actor: Actor): Article {
    const rule = ruleFor(transition)
    requirePermission(actor, rule.permission)

    if (rule.authorOnly) this.guardOwnership(actor)

    if (!isAllowedFrom(transition, this.props.status)) {
      throw new IllegalTransition(this.props.id, transition, this.props.status)
    }

    return this.with({ status: rule.to })
  }

  private guardOwnership(actor: Actor): void {
    const editsAny = actor.can('article:edit_any')
    if (!editsAny && !actor.is(this.props.authorId)) throw new NotOwnArticle(this.props.id)
  }

  private guardApprovedRevision(): void {
    if (this.props.approvedRevisionId === null) throw new MissingApprovedRevision(this.props.id)
  }

  private with(patch: Partial<ArticleProps>): Article {
    return new Article({ ...this.props, ...patch })
  }

  snapshot(): ArticleProps {
    return this.props
  }
}
