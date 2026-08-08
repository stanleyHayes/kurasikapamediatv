import type { Category, CategoryId } from '@kurasikapa/domain'

export interface CategoryRepository {
  findById(id: CategoryId): Promise<Category | null>
  /** Resolves a URL segment in one locale to the category it names. */
  findBySlug(slug: string, locale: string): Promise<Category | null>
  /** Every category reachable in a locale, in navigation order. */
  listForLocale(locale: string): Promise<readonly Category[]>
  save(category: Category): Promise<void>
}
