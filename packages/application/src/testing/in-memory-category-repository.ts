import type { Category, CategoryId } from '@kurasikapa/domain'
import type { CategoryRepository } from '../ports/category-repository'

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly store = new Map<string, Category>()

  constructor(seed: readonly Category[] = []) {
    for (const category of seed) this.store.set(category.id, category)
  }

  findById(id: CategoryId): Promise<Category | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  findBySlug(slug: string, locale: string): Promise<Category | null> {
    const match = this.all().find((c) => c.coversLocale(locale) && c.slugIn(locale).value === slug)
    return Promise.resolve(match ?? null)
  }

  listForLocale(locale: string): Promise<readonly Category[]> {
    const covered = this.all()
      .filter((c) => c.coversLocale(locale))
      .sort((a, b) => a.order - b.order)

    return Promise.resolve(covered)
  }

  save(category: Category): Promise<void> {
    this.store.set(category.id, category)
    return Promise.resolve()
  }

  private all(): Category[] {
    return [...this.store.values()]
  }
}
