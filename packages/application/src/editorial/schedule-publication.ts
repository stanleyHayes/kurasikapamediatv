import type { Actor, ArticleId } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound } from './errors'
import { articleScheduled } from './events'
import { mintTransitionRevision } from './revisions'
import type { TransitionResult } from './submit-for-review'

export interface SchedulePublicationDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly events: EventBusPort
}

export interface SchedulePublicationInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly at: Date
}

export class SchedulePublication implements UseCase<SchedulePublicationInput, TransitionResult> {
  constructor(private readonly deps: SchedulePublicationDeps) {}

  async execute(input: SchedulePublicationInput): Promise<TransitionResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const now = this.deps.clock.now()
    const scheduled = article.schedule(input.actor, input.at, now)

    await this.deps.articles.save(scheduled)
    await mintTransitionRevision(this.deps, scheduled.id, input.actor.id, 'schedule')
    await this.deps.events.publish(
      articleScheduled(
        { articleId: scheduled.id, actorId: input.actor.id, occurredAt: now },
        input.at,
      ),
    )

    return { articleId: scheduled.id, status: scheduled.status }
  }
}
