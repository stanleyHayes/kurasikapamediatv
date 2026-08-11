import type { ArticleId, Comment, CommentId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

export interface CommentRepository {
  findById(id: CommentId): Promise<Comment | null>
  listVisible(articleId: ArticleId, cursor: Cursor): Promise<Page<Comment>>
  listPending(cursor: Cursor): Promise<Page<Comment>>
  save(comment: Comment): Promise<void>
}
