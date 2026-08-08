import type { Page } from '../ports/pagination'
import type { SearchHit, SearchPort, SearchQuery } from '../ports/search'

export class FakeSearch implements SearchPort {
  readonly queries: SearchQuery[] = []

  constructor(private readonly hits: readonly SearchHit[] = []) {}

  search(query: SearchQuery): Promise<Page<SearchHit>> {
    this.queries.push(query)
    return Promise.resolve({ items: this.hits, nextCursor: null })
  }
}
