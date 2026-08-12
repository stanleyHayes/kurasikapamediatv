import { type Article, type ArticleId, isPubliclyVisible } from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { ArticleRepository } from '../ports/article-repository'
import { clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface ListRelatedArticlesInput {
  readonly articleId: ArticleId
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 4, max: 12 } as const

/**
 * Same-section siblings in the article's locale. Not semantic similarity —
 * that waits on EmbeddingPort. Category co-occurrence is honest without a
 * provider, and an empty section stays empty rather than inventing neighbours.
 */
export class ListRelatedArticles implements UseCase<
  ListRelatedArticlesInput,
  readonly Article[]
> {
  constructor(private readonly articles: ArticleRepository) {}

  async execute(input: ListRelatedArticlesInput): Promise<readonly Article[]> {
    const article = await this.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)
    if (!isPubliclyVisible(article.status)) return []

    const limit = clampLimit(input.limit, LIMITS)
    const page = await this.articles.listPublished({
      locale: article.locale,
      categoryId: article.snapshot().categoryId,
      limit: limit + 1,
    })

    return page.items
      .filter((row) => row.id !== article.id && isPubliclyVisible(row.status))
      .slice(0, limit)
  }
}
