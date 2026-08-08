import type { ArticleId, Bookmark, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

/**
 * Every method takes the reader whose list it is.
 *
 * There is deliberately no `findById`: a bookmark has no meaning outside the
 * reader who made it, and an id-addressable one would be a shape of request
 * that reads someone else's list.
 */
export interface BookmarkRepository {
  listFor(readerId: UserId, cursor: Cursor): Promise<Page<Bookmark>>
  isSaved(readerId: UserId, articleId: ArticleId): Promise<boolean>
  save(bookmark: Bookmark): Promise<void>
  remove(readerId: UserId, articleId: ArticleId): Promise<void>
}
