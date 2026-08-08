import type { Cursor, Page } from './pagination'

export interface SearchQuery extends Cursor {
  readonly terms: string
  readonly locale: string
}

export interface SearchHit {
  readonly articleId: string
  readonly slug: string
  readonly title: string
  readonly locale: string
  readonly publishedAt: string | null
  /** Relevance, provider-defined scale. Only the ordering is meaningful. */
  readonly score: number
}

/**
 * Lexical search over published articles.
 *
 * Returns hits rather than Articles: a search result is a projection with a
 * score, not an aggregate, and loading full entities to render a result list
 * would be a read the page does not need.
 *
 * Deliberately separate from VectorSearchPort. Lexical and semantic search
 * have different failure modes, different costs and — for now — different
 * providers. One port covering both would hide which is answering.
 */
export interface SearchPort {
  search(query: SearchQuery): Promise<Page<SearchHit>>
}
