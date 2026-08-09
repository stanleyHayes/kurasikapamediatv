import { type Article, type Category, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { CategoryRepository } from '../ports/category-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import { type Page, clampLimit } from '../ports/pagination'
import { excerptFrom } from './excerpt'
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
}

export interface CategoryPage {
  readonly category: Category
  readonly articles: Page<ListedArticle>
}

/** Long enough for the design's three-line clamp, short enough not to ship the article. */
const EXCERPT_CHARS = 220

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
    const ids = articles
      .map((a) => a.snapshot().approvedRevisionId)
      .filter((id): id is NonNullable<typeof id> => id !== null)

    const revisions = await this.deps.revisions.findManyByIds(ids)
    const byId = new Map(revisions.map((r) => [r.id, r.body]))

    return articles.map((article) => {
      const revisionId = article.snapshot().approvedRevisionId
      const body = revisionId === null ? undefined : byId.get(revisionId)

      return { article, excerpt: body === undefined ? null : excerptFrom(body, EXCERPT_CHARS) }
    })
  }
}
