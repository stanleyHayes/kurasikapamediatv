import type { Actor, ArticleId } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound } from './errors'
import { articleUnpublished } from './events'
import type { TransitionResult } from './submit-for-review'

export interface UnpublishArticleDeps {
  readonly articles: ArticleRepository
  readonly clock: ClockPort
  readonly events: EventBusPort
}

export interface UnpublishArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  /** Why it was pulled. Retained for the audit log — corrections must be traceable. */
  readonly reason: string
}

/**
 * Pulls a published article.
 *
 * The article keeps its approved revision, so republishing after a correction
 * does not require a second trip through review.
 */
export class UnpublishArticle implements UseCase<UnpublishArticleInput, TransitionResult> {
  constructor(private readonly deps: UnpublishArticleDeps) {}

  async execute(input: UnpublishArticleInput): Promise<TransitionResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const pulled = article.unpublish(input.actor)

    await this.deps.articles.save(pulled)
    await this.deps.events.publish(
      articleUnpublished(
        {
          articleId: pulled.id,
          actorId: input.actor.id,
          occurredAt: this.deps.clock.now(),
        },
        input.reason,
      ),
    )

    return { articleId: pulled.id, status: pulled.status }
  }
}
