import type { Actor, ArticleId } from '@kurasikapa/domain'
import type { UseCase } from '../ports/use-case'
import { type PublishArticleDeps, publishAndAnnounce } from './publish-article'

export interface PublishDueArticlesInput {
  /** A system actor holding `article:publish`, supplied by the composition root. */
  readonly actor: Actor
}

export interface PublishDueArticlesResult {
  readonly published: readonly ArticleId[]
  readonly failed: readonly { articleId: ArticleId; reason: string }[]
}

/**
 * The scheduled-publication cron.
 *
 * One article failing must not strand the rest of the batch, so failures are
 * collected and returned rather than thrown. The caller logs and alerts on a
 * non-empty `failed` — silently swallowing them would mean a scheduled article
 * quietly never goes live, which is the worst outcome for a newsroom.
 */
export class PublishDueArticles implements UseCase<PublishDueArticlesInput, PublishDueArticlesResult> {
  constructor(private readonly deps: PublishArticleDeps) {}

  async execute(input: PublishDueArticlesInput): Promise<PublishDueArticlesResult> {
    const now = this.deps.clock.now()
    const due = await this.deps.articles.listDueForPublication(now)

    const published: ArticleId[] = []
    const failed: { articleId: ArticleId; reason: string }[] = []

    for (const article of due) {
      try {
        await publishAndAnnounce(this.deps, article, input.actor, now)
        published.push(article.id)
      } catch (error) {
        failed.push({ articleId: article.id, reason: describe(error) })
      }
    }

    return { published, failed }
  }
}

/**
 * Flattens an error into something an operator can act on.
 *
 * An AggregateError's own message is "1 subscriber(s) failed", which names the
 * count and hides the cause — reporting that alone is a failure that is
 * technically logged and practically invisible, which is the exact thing this
 * batch reporting exists to prevent.
 */
const describe = (error: unknown): string => {
  if (error instanceof AggregateError) {
    return `${error.message}: ${error.errors.map(describe).join('; ')}`
  }

  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}
