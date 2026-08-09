import type { ArticleId, Revision, RevisionId } from '@kurasikapa/domain'

export interface RevisionRepository {
  findById(id: RevisionId): Promise<Revision | null>
  /** The newest revision for an article, or null if it has no history yet. */
  findLatest(articleId: ArticleId): Promise<Revision | null>
  listFor(articleId: ArticleId): Promise<readonly Revision[]>
  /**
   * Batch read for listings.
   *
   * A section page showing 12 standfirsts would otherwise be 13 round trips.
   * Order is not guaranteed — callers index by id.
   */
  findManyByIds(ids: readonly RevisionId[]): Promise<readonly Revision[]>
  /** Append-only. There is deliberately no update and no delete. */
  append(revision: Revision): Promise<void>
}
