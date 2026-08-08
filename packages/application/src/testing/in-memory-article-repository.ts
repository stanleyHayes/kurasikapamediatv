import type { Article, ArticleId } from '@kurasikapa/domain'
import type {
  ArticleRepository,
  AuthoredQuery,
  PublishedQuery,
} from '../ports/article-repository.js'
import type { Cursor, Page } from '../ports/pagination.js'

/**
 * Hand-written, not generated and not auto-mocked.
 *
 * It behaves like the real thing for the rules a use case can observe —
 * cursor paging, ordering, due-for-publication — so a passing test means the
 * orchestration is right, not that a mock was configured to agree with it.
 */
export class InMemoryArticleRepository implements ArticleRepository {
  private readonly store = new Map<string, Article>()

  constructor(seed: readonly Article[] = []) {
    for (const article of seed) this.store.set(article.id, article)
  }

  findById(id: ArticleId): Promise<Article | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  findBySlug(slug: string, locale: string): Promise<Article | null> {
    const match = this.all().find((a) => a.slug.value === slug && a.locale === locale)
    return Promise.resolve(match ?? null)
  }

  listPublished(query: PublishedQuery): Promise<Page<Article>> {
    const matches = this.all()
      .filter((a) => a.status === 'published' && a.locale === query.locale)
      .filter((a) => query.categoryId === undefined || a.snapshot().categoryId === query.categoryId)
      .sort(byNewestPublished)

    return Promise.resolve(paginate(matches, query))
  }

  listAuthoredBy(query: AuthoredQuery): Promise<Page<Article>> {
    const matches = this.all().filter((a) => a.authorId === query.authorId)
    return Promise.resolve(paginate(matches, query))
  }

  listDueForPublication(now: Date): Promise<readonly Article[]> {
    return Promise.resolve(this.all().filter((a) => a.isDueForPublication(now)))
  }

  save(article: Article): Promise<void> {
    this.store.set(article.id, article)
    return Promise.resolve()
  }

  /** Test affordance — not part of the port. */
  count(): number {
    return this.store.size
  }

  private all(): Article[] {
    return [...this.store.values()]
  }
}

const byNewestPublished = (a: Article, b: Article): number =>
  (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)

function paginate(items: readonly Article[], cursor: Cursor): Page<Article> {
  const start = cursor.after === undefined ? 0 : items.findIndex((a) => a.id === cursor.after) + 1
  const slice = items.slice(start, start + cursor.limit)
  const next = items[start + cursor.limit]

  return { items: slice, nextCursor: next?.id ?? null }
}
