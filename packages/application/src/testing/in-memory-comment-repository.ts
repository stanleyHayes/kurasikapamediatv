import type { ArticleId, Comment, CommentId } from '@kurasikapa/domain'
import type { CommentRepository } from '../ports/comment-repository'
import type { Cursor, Page } from '../ports/pagination'

export class InMemoryCommentRepository implements CommentRepository {
  private readonly rows = new Map<string, Comment>()

  findById(id: CommentId): Promise<Comment | null> {
    return Promise.resolve(this.rows.get(id) ?? null)
  }

  listVisible(articleId: ArticleId, cursor: Cursor): Promise<Page<Comment>> {
    return Promise.resolve(
      this.page(
        [...this.rows.values()].filter((c) => c.articleId === articleId && c.state === 'visible'),
        cursor,
        -1,
      ),
    )
  }

  listPending(cursor: Cursor): Promise<Page<Comment>> {
    return Promise.resolve(
      this.page(
        [...this.rows.values()].filter((c) => c.state === 'pending'),
        cursor,
        1,
      ),
    )
  }

  save(comment: Comment): Promise<void> {
    this.rows.set(comment.id, comment)
    return Promise.resolve()
  }

  private page(items: Comment[], cursor: Cursor, direction: 1 | -1): Page<Comment> {
    const sorted = [...items].sort((a, b) => {
      const delta = a.snapshot().createdAt.getTime() - b.snapshot().createdAt.getTime()
      return direction * delta
    })
    const start = cursor.after === undefined ? 0 : sorted.findIndex((c) => c.id === cursor.after) + 1
    const slice = sorted.slice(Math.max(0, start), Math.max(0, start) + cursor.limit)
    const more = start + cursor.limit < sorted.length

    return { items: slice, nextCursor: more ? (slice.at(-1)?.id ?? null) : null }
  }
}
