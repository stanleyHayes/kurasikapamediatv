import { type Actor, type ArticleId, Like } from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { ClockPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { LikeRepository } from '../ports/like-repository'
import type { UseCase } from '../ports/use-case'

export interface LikeArticleDeps {
  readonly likes: LikeRepository
  readonly articles: ArticleRepository
  readonly clock: ClockPort
}

export interface LikeArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * Records a like. Idempotent: a second tap is still liked, not an error.
 */
export class LikeArticle implements UseCase<LikeArticleInput, { liked: true; count: number }> {
  constructor(private readonly deps: LikeArticleDeps) {}

  async execute(input: LikeArticleInput): Promise<{ liked: true; count: number }> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    await this.deps.likes.save(Like.create(input.actor.id, article, this.deps.clock.now()))

    return { liked: true, count: await this.deps.likes.countFor(input.articleId) }
  }
}
