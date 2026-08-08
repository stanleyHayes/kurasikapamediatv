import { type Actor, requirePermission } from '../identity/actor'
import type { ArticleId, CategoryId, FamilyId, RevisionId, TagId, UserId } from '../shared/ids'
import type { Slug } from '../shared/slug'
import { type ArticleStatus, type Transition, isAllowedFrom, ruleFor } from './article-status'
import {
  IllegalTransition,
  MissingApprovedRevision,
  NotEditable,
  NotOwnArticle,
  ScheduleInPast,
  SlugIsFrozen,
} from './errors'

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

/** What a caller supplies to create a draft. Everything else is derived. */
export interface NewArticle {
  readonly id: ArticleId
  readonly familyId: FamilyId
  readonly locale: string
  readonly slug: Slug
  readonly title: string
  readonly categoryId: CategoryId
  readonly tagIds?: readonly TagId[]
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

  /** Rebuild from storage. Applies no rules — the article already existed. */
  static reconstitute(props: ArticleProps): Article {
    return new Article(props)
  }

  /** A brand-new draft. The only way an Article comes into existence. */
  static create(actor: Actor, input: NewArticle): Article {
    requirePermission(actor, 'article:draft')

    return new Article({
      ...input,
      tagIds: input.tagIds ?? [],
      authorId: actor.id,
      status: 'draft',
      approvedRevisionId: null,
      scheduledAt: null,
      publishedAt: null,
    })
  }

  get id(): ArticleId { return this.props.id }
  get familyId(): FamilyId { return this.props.familyId }
  get locale(): string { return this.props.locale }
  get slug(): Slug { return this.props.slug }
  get authorId(): UserId { return this.props.authorId }
  get status(): ArticleStatus { return this.props.status }
  get scheduledAt(): Date | null { return this.props.scheduledAt }
  get publishedAt(): Date | null { return this.props.publishedAt }

  /**
   * Retitling a draft. The slug follows the title until the article has been
   * published; after that it is frozen.
   *
   * A published URL is a promise to everyone who linked to it, shared it, or
   * indexed it. Changing the slug silently breaks every one of those, and the
   * gain is cosmetic.
   */
  retitle(actor: Actor, title: string, slug: Slug): Article {
    this.guardEditable(actor)

    if (this.hasBeenPublished() && !slug.equals(this.props.slug)) {
      throw new SlugIsFrozen(this.props.id)
    }

    return this.with({ title, slug })
  }

  /** True once the article has ever gone live, even if since unpublished. */
  hasBeenPublished(): boolean {
    return this.props.publishedAt !== null
  }

  private guardEditable(actor: Actor): void {
    requirePermission(actor, 'article:edit_own')
    this.guardOwnership(actor)

    // Editing text that is under review, scheduled or live would change what
    // an editor approved out from under them. Those paths go through the
    // workflow: reject it, or unpublish it, then edit.
    const editable: readonly ArticleStatus[] = ['draft', 'unpublished']
    if (!editable.includes(this.props.status)) {
      throw new NotEditable(this.props.id, this.props.status)
    }
  }

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
