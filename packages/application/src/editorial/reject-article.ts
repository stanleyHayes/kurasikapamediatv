import type { Actor, ArticleId } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound } from './errors'
import { articleRejected } from './events'
import { mintTransitionRevision } from './revisions'
import type { TransitionResult } from './submit-for-review'

export interface RejectArticleDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly events: EventBusPort
}

export interface RejectArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  /** Shown to the author. Carried on the event for the notification subscriber. */
  readonly note: string
}

export class RejectArticle implements UseCase<RejectArticleInput, TransitionResult> {
  constructor(private readonly deps: RejectArticleDeps) {}

  async execute(input: RejectArticleInput): Promise<TransitionResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const rejected = article.reject(input.actor)

    await this.deps.articles.save(rejected)
    await mintTransitionRevision(this.deps, rejected.id, input.actor.id, 'reject')
    await this.deps.events.publish(
      articleRejected(
        {
          articleId: rejected.id,
          actorId: input.actor.id,
          occurredAt: this.deps.clock.now(),
        },
        input.note,
      ),
    )

    return { articleId: rejected.id, status: rejected.status }
  }
}
