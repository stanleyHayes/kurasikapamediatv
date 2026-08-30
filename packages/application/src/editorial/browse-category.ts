import { type Article, type Category, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { CategoryRepository } from '../ports/category-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import { type Page, clampLimit } from '../ports/pagination'
import { withApprovedListing } from './approved-listing'
import type { UseCase } from '../ports/use-case'

export interface BrowseCategoryDeps {
  readonly categories: CategoryRepository
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
}

export interface BrowseCategoryInput {
  readonly slug: string
  readonly locale: string
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

export interface ListedArticle {
  readonly article: Article
  /** Opening of the APPROVED revision. Null if the approval predates history. */
  readonly excerpt: string | null
  readonly readingMinutes: number
}

export interface CategoryPage {
  readonly category: Category
  readonly articles: Page<ListedArticle>
}

const LIMITS = { fallback: 12, max: 50 }

/**
 * A section page: the category, plus its published articles.
 *
 * Returns null rather than throwing when the slug does not resolve — an
 * unknown section is a 404, not an error, and the page decides how to say so.
 */
export class BrowseCategory implements UseCase<BrowseCategoryInput, CategoryPage | null> {
  constructor(private readonly deps: BrowseCategoryDeps) {}

  async execute(input: BrowseCategoryInput): Promise<CategoryPage | null> {
    const category = await this.deps.categories.findBySlug(input.slug, input.locale)
    if (category === null) return null

    const page = await this.deps.articles.listPublished({
      locale: input.locale,
      categoryId: category.id,
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    // Same belt-and-braces as the homepage: the repository filters, and so do
    // we. A reader must never see a draft because a query was edited carelessly.
    const items = page.items.filter((a) => isPubliclyVisible(a.status))

    return {
      category,
      articles: { items: await this.withExcerpts(items), nextCursor: page.nextCursor },
    }
  }

  private async withExcerpts(articles: readonly Article[]): Promise<readonly ListedArticle[]> {
    return withApprovedListing(articles, this.deps.revisions)
  }
}
