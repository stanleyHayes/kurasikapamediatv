import type { ArticleId, Revision, RevisionId } from '@kurasikapa/domain'
import type { RevisionRepository } from '../ports/revision-repository'

/** Append-only, like the real collection. There is no update and no delete. */
export class InMemoryRevisionRepository implements RevisionRepository {
  private readonly store: Revision[] = []

  constructor(seed: readonly Revision[] = []) {
    this.store.push(...seed)
  }

  findById(id: RevisionId): Promise<Revision | null> {
    return Promise.resolve(this.store.find((r) => r.id === id) ?? null)
  }

  findLatest(articleId: ArticleId): Promise<Revision | null> {
    const forArticle = this.forArticle(articleId)
    return Promise.resolve(forArticle.at(-1) ?? null)
  }

  listFor(articleId: ArticleId): Promise<readonly Revision[]> {
    return Promise.resolve(this.forArticle(articleId))
  }

  findManyByIds(ids: readonly RevisionId[]): Promise<readonly Revision[]> {
    const wanted = new Set(ids)
    return Promise.resolve(this.store.filter((r) => wanted.has(r.id)))
  }

  append(revision: Revision): Promise<void> {
    this.store.push(revision)
    return Promise.resolve()
  }

  private forArticle(articleId: ArticleId): Revision[] {
    return this.store.filter((r) => r.articleId === articleId).sort((a, b) => a.seq - b.seq)
  }
}
