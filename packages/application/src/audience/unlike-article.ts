import type { Actor, ArticleId } from '@kurasikapa/domain'
import type { LikeRepository } from '../ports/like-repository'
import type { UseCase } from '../ports/use-case'

export interface UnlikeArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * Removes a like. Removing one that was never there succeeds.
 */
export class UnlikeArticle implements UseCase<UnlikeArticleInput, { liked: false; count: number }> {
  constructor(private readonly likes: LikeRepository) {}

  async execute(input: UnlikeArticleInput): Promise<{ liked: false; count: number }> {
    await this.likes.remove(input.actor.id, input.articleId)

    return { liked: false, count: await this.likes.countFor(input.articleId) }
  }
}
