import type { Category } from '@kurasikapa/domain'
import type { CategoryRepository } from '../ports/category-repository'
import type { UseCase } from '../ports/use-case'

export interface ListSectionsDeps {
  readonly categories: CategoryRepository
}

export interface ListSectionsInput {
  readonly locale: string
}

/**
 * The site's navigation for one locale, in order.
 *
 * Categories with no slug in the locale are absent rather than shown broken —
 * see Category.coversLocale.
 */
export class ListSections implements UseCase<ListSectionsInput, readonly Category[]> {
  constructor(private readonly deps: ListSectionsDeps) {}

  async execute(input: ListSectionsInput): Promise<readonly Category[]> {
    const sections = await this.deps.categories.listForLocale(input.locale)
    return sections
  }
}
