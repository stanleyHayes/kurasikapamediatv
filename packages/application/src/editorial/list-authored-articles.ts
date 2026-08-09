import type { Actor, Article } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import { type Page, clampLimit } from '../ports/pagination'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { excerptFrom } from './excerpt'

export interface ListAuthoredArticlesDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
}

export interface AuthoredArticle {
  readonly article: Article
  /**
   * Opening of the LATEST revision — deliberately not the approved one.
   *
   * The studio shows an editor the work in progress. Showing the approved
   * text here would hide the very correction they are writing.
   */
  readonly excerpt: string | null
}

/** One truncated line in the pipeline row. */
const EXCERPT_CHARS = 140

export interface ListAuthoredArticlesInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 25, max: 100 }

/**
 * "My drafts" in the CMS.
 *
 * Scoped to the actor's own id, never to an id supplied by the caller — a
 * `userId` parameter here would let any journalist read any colleague's
 * unpublished work by changing a query string.
 */
export class ListAuthoredArticles
  implements UseCase<ListAuthoredArticlesInput, Page<AuthoredArticle>>
{
  constructor(private readonly deps: ListAuthoredArticlesDeps) {}

  /** async for the same reason as ListAwaitingReview: a sync throw from a
   * method typed `Promise<T>` escapes `.catch()`. */
  async execute(input: ListAuthoredArticlesInput): Promise<Page<AuthoredArticle>> {
    const page = await this.deps.articles.listAuthoredBy({
      authorId: input.actor.id,
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    const latest = await this.deps.revisions.findLatestForArticles(page.items.map((a) => a.id))
    const byArticle = new Map(latest.map((r) => [r.articleId, r.body]))

    return {
      items: page.items.map((article) => {
        const body = byArticle.get(article.id)

        return { article, excerpt: body === undefined ? null : excerptFrom(body, EXCERPT_CHARS) }
      }),
      nextCursor: page.nextCursor,
    }
  }
}

