import type { Article, ArticleId, CategoryId, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

export interface PublishedQuery extends Cursor {
  readonly locale: string
  readonly categoryId?: CategoryId | undefined
}

export interface AuthoredQuery extends Cursor {
  readonly authorId: UserId
}

/**
 * Speaks Article, never documents. No ObjectId, no Collection, no filter
 * object crosses this boundary — that is what makes the adapter swappable.
 */
export interface ArticleRepository {
  findById(id: ArticleId): Promise<Article | null>
  findBySlug(slug: string, locale: string): Promise<Article | null>
  /**
   * Batch read for a saved list. One query for a page of bookmarks rather than
   * one per bookmark — a 20-item list would otherwise be 21 round trips.
   */
  findManyByIds(ids: readonly ArticleId[]): Promise<readonly Article[]>
  listPublished(query: PublishedQuery): Promise<Page<Article>>
  listAuthoredBy(query: AuthoredQuery): Promise<Page<Article>>
  /**
   * Everything awaiting an editorial decision, across all authors.
   *
   * Unscoped by author on purpose — that is the whole point of a review queue,
   * and the authorisation for it lives in the use case.
   */
  listAwaitingReview(cursor: Cursor): Promise<Page<Article>>
  /** Every article whose scheduled moment has arrived. Drives the cron. */
  listDueForPublication(now: Date): Promise<readonly Article[]>
  save(article: Article): Promise<void>
}
