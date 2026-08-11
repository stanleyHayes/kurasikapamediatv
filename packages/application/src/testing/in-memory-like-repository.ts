import type { ArticleId, Like, UserId } from '@kurasikapa/domain'
import type { LikeRepository } from '../ports/like-repository'

const key = (reader: string, article: string): string => `${reader}:${article}`

export class InMemoryLikeRepository implements LikeRepository {
  private readonly rows = new Map<string, Like>()

  isLiked(readerId: UserId, articleId: ArticleId): Promise<boolean> {
    return Promise.resolve(this.rows.has(key(readerId, articleId)))
  }

  countFor(articleId: ArticleId): Promise<number> {
    return Promise.resolve([...this.rows.values()].filter((like) => like.articleId === articleId).length)
  }

  save(like: Like): Promise<void> {
    this.rows.set(key(like.readerId, like.articleId), like)
    return Promise.resolve()
  }

  remove(readerId: UserId, articleId: ArticleId): Promise<void> {
    this.rows.delete(key(readerId, articleId))
    return Promise.resolve()
  }
}
