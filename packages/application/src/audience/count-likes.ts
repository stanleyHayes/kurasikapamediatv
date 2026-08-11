import type { ArticleId, UserId } from '@kurasikapa/domain'
import type { LikeRepository } from '../ports/like-repository'
import type { UseCase } from '../ports/use-case'

export interface CountLikesInput {
  readonly articleId: ArticleId
  readonly readerId?: UserId | undefined
}

export interface CountLikesResult {
  readonly count: number
  readonly liked: boolean
}

export class CountLikes implements UseCase<CountLikesInput, CountLikesResult> {
  constructor(private readonly likes: LikeRepository) {}

  async execute(input: CountLikesInput): Promise<CountLikesResult> {
    const liked =
      input.readerId === undefined ? false : await this.likes.isLiked(input.readerId, input.articleId)

    return { count: await this.likes.countFor(input.articleId), liked }
  }
}
