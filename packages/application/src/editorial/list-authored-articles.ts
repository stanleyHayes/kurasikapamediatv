import type { Actor, Article } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { Page } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface ListAuthoredArticlesDeps {
  readonly articles: ArticleRepository
}

export interface ListAuthoredArticlesInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * "My drafts" in the CMS.
 *
 * Scoped to the actor's own id, never to an id supplied by the caller — a
 * `userId` parameter here would let any journalist read any colleague's
 * unpublished work by changing a query string.
 */
export class ListAuthoredArticles
  implements UseCase<ListAuthoredArticlesInput, Page<Article>>
{
  constructor(private readonly deps: ListAuthoredArticlesDeps) {}

  execute(input: ListAuthoredArticlesInput): Promise<Page<Article>> {
    return this.deps.articles.listAuthoredBy({
      authorId: input.actor.id,
      after: input.after,
      limit: clampLimit(input.limit),
    })
  }
}

function clampLimit(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_LIMIT
  if (!Number.isInteger(requested) || requested < 1) return DEFAULT_LIMIT

  return Math.min(requested, MAX_LIMIT)
}
