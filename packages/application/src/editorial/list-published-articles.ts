import { type Article, type CategoryId, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import { type Page, clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface ListPublishedArticlesDeps {
  readonly articles: ArticleRepository
}

export interface ListPublishedArticlesInput {
  readonly locale: string
  readonly categoryId?: CategoryId | undefined
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 12, max: 50 }

export class ListPublishedArticles
  implements UseCase<ListPublishedArticlesInput, Page<Article>>
{
  constructor(private readonly deps: ListPublishedArticlesDeps) {}

  async execute(input: ListPublishedArticlesInput): Promise<Page<Article>> {
    const page = await this.deps.articles.listPublished({
      locale: input.locale,
      categoryId: input.categoryId,
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    // Belt and braces: the repository filters, and so do we. A reader must
    // never see a draft because a query was edited carelessly.
    const visible = page.items.filter((a) => isPubliclyVisible(a.status))

    return { items: visible, nextCursor: page.nextCursor }
  }
}

/**
 * `limit` reaches this from a query string. Unclamped, a caller could ask for
 * every article ever published in one request.
 */
