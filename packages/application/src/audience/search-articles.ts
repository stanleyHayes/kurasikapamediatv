import { type Page, clampLimit } from '../ports/pagination'
import type { SearchHit, SearchPort } from '../ports/search'
import type { UseCase } from '../ports/use-case'

export interface SearchArticlesDeps {
  readonly search: SearchPort
}

export interface SearchArticlesInput {
  readonly terms: string
  readonly locale: string
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 20, max: 50 }
const MIN_TERM_LENGTH = 2

/** An empty result set, for queries not worth sending to the index. */
const NOTHING: Page<SearchHit> = { items: [], nextCursor: null }

/**
 * Search over published articles.
 *
 * A blank or one-character query returns nothing rather than everything. On a
 * news archive "everything" is both a useless answer and an expensive one, and
 * an empty search box submitted by accident should not scan the corpus.
 */
export class SearchArticles implements UseCase<SearchArticlesInput, Page<SearchHit>> {
  constructor(private readonly deps: SearchArticlesDeps) {}

  async execute(input: SearchArticlesInput): Promise<Page<SearchHit>> {
    const terms = input.terms.trim()
    if (terms.length < MIN_TERM_LENGTH) return NOTHING

    const page = await this.deps.search.search({
      terms,
      locale: input.locale,
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    return page
  }
}
