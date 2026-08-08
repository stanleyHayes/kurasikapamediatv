import { type Article, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { UseCase } from '../ports/use-case'

export interface GetPublishedArticleDeps {
  readonly articles: ArticleRepository
}

export interface GetPublishedArticleInput {
  readonly slug: string
  readonly locale: string
}

/**
 * The reader-facing article lookup.
 *
 * Visibility is decided by the domain, not by a repository filter. A query that
 * merely forgot `status: 'published'` would serve an unpublished draft to the
 * public — so the check lives where it can be tested without a database, and
 * happens even though the repository could have filtered it.
 */
export class GetPublishedArticle implements UseCase<GetPublishedArticleInput, Article | null> {
  constructor(private readonly deps: GetPublishedArticleDeps) {}

  async execute(input: GetPublishedArticleInput): Promise<Article | null> {
    const article = await this.deps.articles.findBySlug(input.slug, input.locale)
    if (article === null) return null

    return isPubliclyVisible(article.status) ? article : null
  }
}
