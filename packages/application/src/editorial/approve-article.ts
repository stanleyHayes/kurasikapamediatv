import type { Actor, ArticleId, RevisionId } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound, RevisionNotFound, RevisionNotOfArticle } from './errors'
import { articleApproved } from './events'
import type { TransitionResult } from './submit-for-review'

export interface ApproveArticleDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly events: EventBusPort
}

export interface ApproveArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  /** The exact revision being approved — approval is of text, not of an id. */
  readonly revisionId: RevisionId
}

export class ApproveArticle implements UseCase<ApproveArticleInput, TransitionResult> {
  constructor(private readonly deps: ApproveArticleDeps) {}

  async execute(input: ApproveArticleInput): Promise<TransitionResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    await this.guardRevisionBelongs(input)

    const approved = article.approve(input.actor, input.revisionId)

    await this.deps.articles.save(approved)
    await this.deps.events.publish(
      articleApproved(
        {
          articleId: approved.id,
          actorId: input.actor.id,
          occurredAt: this.deps.clock.now(),
        },
        input.revisionId,
      ),
    )

    return { articleId: approved.id, status: approved.status }
  }

  /**
   * Without this an editor could approve article A while pointing at a
   * revision of article B, and the wrong text would publish.
   */
  private async guardRevisionBelongs(input: ApproveArticleInput): Promise<void> {
    const revision = await this.deps.revisions.findById(input.revisionId)
    if (revision === null) throw new RevisionNotFound(input.revisionId)
    if (revision.articleId !== input.articleId) {
      throw new RevisionNotOfArticle(input.revisionId, input.articleId)
    }
  }
}
