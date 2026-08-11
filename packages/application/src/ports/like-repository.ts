import type { ArticleId, Like, UserId } from '@kurasikapa/domain'

export interface LikeRepository {
  isLiked(readerId: UserId, articleId: ArticleId): Promise<boolean>
  countFor(articleId: ArticleId): Promise<number>
  save(like: Like): Promise<void>
  remove(readerId: UserId, articleId: ArticleId): Promise<void>
}
