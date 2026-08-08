import { type Article, type Category, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { CategoryRepository } from '../ports/category-repository'
import { type Page, clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface BrowseCategoryDeps {
  readonly categories: CategoryRepository
  readonly articles: ArticleRepository
}

export interface BrowseCategoryInput {
  readonly slug: string
  readonly locale: string
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

export interface CategoryPage {
  readonly category: Category
  readonly articles: Page<Article>
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

    return { category, articles: { items, nextCursor: page.nextCursor } }
  }
}
