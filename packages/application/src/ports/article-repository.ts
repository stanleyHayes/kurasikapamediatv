import type { Article, ArticleId, CategoryId, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination.js'

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
  listPublished(query: PublishedQuery): Promise<Page<Article>>
  listAuthoredBy(query: AuthoredQuery): Promise<Page<Article>>
  /** Every article whose scheduled moment has arrived. Drives the cron. */
  listDueForPublication(now: Date): Promise<readonly Article[]>
  save(article: Article): Promise<void>
}
