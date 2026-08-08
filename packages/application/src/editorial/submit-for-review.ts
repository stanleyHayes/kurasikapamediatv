import type { Actor, ArticleId, ArticleStatus } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort } from '../ports/ambient.js'
import type { ArticleRepository } from '../ports/article-repository.js'
import type { UseCase } from '../ports/use-case.js'
import { ArticleNotFound } from './errors.js'
import { articleSubmitted } from './events.js'

export interface SubmitForReviewDeps {
  readonly articles: ArticleRepository
  readonly clock: ClockPort
  readonly events: EventBusPort
}

export interface SubmitForReviewInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

export interface TransitionResult {
  readonly articleId: ArticleId
  readonly status: ArticleStatus
}

export class SubmitForReview implements UseCase<SubmitForReviewInput, TransitionResult> {
  constructor(private readonly deps: SubmitForReviewDeps) {}

  async execute(input: SubmitForReviewInput): Promise<TransitionResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const submitted = article.submitForReview(input.actor)

    await this.deps.articles.save(submitted)
    await this.deps.events.publish(
      articleSubmitted({
        articleId: submitted.id,
        actorId: input.actor.id,
        occurredAt: this.deps.clock.now(),
      }),
    )

    return { articleId: submitted.id, status: submitted.status }
  }
}
