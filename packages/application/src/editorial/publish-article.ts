import type { Actor, Article, ArticleId } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound } from './errors'
import { articlePublished } from './events'
import { mintTransitionRevision } from './revisions'
import type { TransitionResult } from './submit-for-review'

export interface PublishArticleDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly events: EventBusPort
}

export interface PublishArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

export interface PublishArticleResult extends TransitionResult {
  readonly slug: string
  readonly locale: string
  readonly publishedAt: Date
}

export class PublishArticle implements UseCase<PublishArticleInput, PublishArticleResult> {
  constructor(private readonly deps: PublishArticleDeps) {}

  async execute(input: PublishArticleInput): Promise<PublishArticleResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    return publishAndAnnounce(this.deps, article, input.actor, this.deps.clock.now())
  }
}

/**
 * Shared with PublishDueArticles so the cron path and the editor path cannot
 * drift — one of them acquiring an extra rule and the other not is exactly how
 * scheduled posts end up behaving differently from manual ones.
 */
export async function publishAndAnnounce(
  deps: PublishArticleDeps,
  article: Article,
  actor: Actor,
  now: Date,
): Promise<PublishArticleResult> {
  const published = article.publish(actor, now)

  await deps.articles.save(published)
  await mintTransitionRevision(deps, published.id, actor.id, 'publish')

  // The article IS published by this point. A failing subscriber must not turn
  // that into an error, for two reasons that both bite:
  //
  //   - An editor told "publish failed" presses publish again.
  //   - The scheduled-publication cron marks it failed and retries next
  //     minute. The domain then refuses published → published, so the retry
  //     fails too — for ever. An alert that never clears, about an article
  //     that has been live the whole time.
  //
  // This is not a silent failure: the event bus collects its subscribers'
  // errors and is responsible for reporting them, and a stale cache expires on
  // its own. See EventBusPort.
  await deps.events
    .publish(
      articlePublished(
        { articleId: published.id, actorId: actor.id, occurredAt: now },
        published.slug.value,
        published.locale,
      ),
    )
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          event: 'article.published.announce_failed',
          articleId: published.id,
          reason: error instanceof Error ? error.message : String(error),
        }),
      )
    })

  return {
    articleId: published.id,
    status: published.status,
    slug: published.slug.value,
    locale: published.locale,
    publishedAt: now,
  }
}
