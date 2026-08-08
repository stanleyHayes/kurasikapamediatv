import { type Actor, type Article, requirePermission } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import { type Page, clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface ListAwaitingReviewDeps {
  readonly articles: ArticleRepository
}

export interface ListAwaitingReviewInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 25, max: 100 }

/**
 * The editorial review queue.
 *
 * Unlike "my drafts", this deliberately crosses author boundaries — so the
 * permission check is the only thing standing between a journalist and every
 * colleague's submission. It is checked here rather than in the page, because
 * a page is one caller and this is a rule.
 */
export class ListAwaitingReview implements UseCase<ListAwaitingReviewInput, Page<Article>> {
  constructor(private readonly deps: ListAwaitingReviewDeps) {}

  /**
   * `async` deliberately, not a sync function returning a promise.
   *
   * `requirePermission` throws, and a synchronous throw from a method typed
   * `Promise<T>` escapes any caller using `.catch()` — the refusal would
   * surface as an unhandled error instead of a denied request.
   */
  async execute(input: ListAwaitingReviewInput): Promise<Page<Article>> {
    requirePermission(input.actor, 'article:approve')

    const page = await this.deps.articles.listAwaitingReview({
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    return page
  }
}

