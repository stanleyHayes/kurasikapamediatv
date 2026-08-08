import type { Actor, Article, ArticleId } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound } from './errors'
import { articlePublished } from './events'
import type { TransitionResult } from './submit-for-review'

export interface PublishArticleDeps {
  readonly articles: ArticleRepository
  readonly clock: ClockPort
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
  await deps.events.publish(
    articlePublished(
      { articleId: published.id, actorId: actor.id, occurredAt: now },
      published.slug.value,
      published.locale,
    ),
  )

  return {
    articleId: published.id,
    status: published.status,
    slug: published.slug.value,
    locale: published.locale,
    publishedAt: now,
  }
}
