import type { ClockPort } from '@kurasikapa/application'
import type {
  ArticleRepository,
  AuthoredQuery,
  Page,
  PublishedQuery,
} from '@kurasikapa/application'
import type { Article, ArticleId } from '@kurasikapa/domain'
import type { Collection, Db, Filter } from 'mongodb'
import { ARTICLES, type ArticleDocument } from './documents'
import { articleToDocument, articleToDomain } from './mappers'

export interface MongoArticleRepositoryDeps {
  readonly db: Db
  /** Injected so `updatedAt` is deterministic in tests, like every other timestamp. */
  readonly clock: ClockPort
}

export class MongoArticleRepository implements ArticleRepository {
  private readonly articles: Collection<ArticleDocument>

  constructor(private readonly deps: MongoArticleRepositoryDeps) {
    this.articles = deps.db.collection<ArticleDocument>(ARTICLES)
  }

  async findById(id: ArticleId): Promise<Article | null> {
    const doc = await this.articles.findOne({ _id: id })
    return doc === null ? null : articleToDomain(doc)
  }

  async findBySlug(slug: string, locale: string): Promise<Article | null> {
    const doc = await this.articles.findOne({ slug, locale })
    return doc === null ? null : articleToDomain(doc)
  }

  async listPublished(query: PublishedQuery): Promise<Page<Article>> {
    const filter: Filter<ArticleDocument> = { status: 'published', locale: query.locale }
    if (query.categoryId !== undefined) filter.categoryId = query.categoryId

    return this.keysetPage(filter, query.after, query.limit)
  }

  async listAuthoredBy(query: AuthoredQuery): Promise<Page<Article>> {
    const docs = await this.articles
      .find({ authorId: query.authorId })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .toArray()

    return sliceToPage(docs, query.limit)
  }

  async listDueForPublication(now: Date): Promise<readonly Article[]> {
    const docs = await this.articles
      .find({ status: 'scheduled', scheduledAt: { $lte: now } })
      .sort({ scheduledAt: 1 })
      .toArray()

    return docs.map(articleToDomain)
  }

  async save(article: Article): Promise<void> {
    const doc = articleToDocument(article, this.deps.clock.now())
    const { _id, ...rest } = doc

    await this.articles.updateOne({ _id }, { $set: rest }, { upsert: true })
  }

  /**
   * Keyset pagination on the compound sort key (publishedAt, _id).
   *
   * Offset paging on a news archive both degrades as the archive grows and
   * silently shifts results when something publishes mid-scroll — the reader
   * sees the same article twice, or misses one entirely.
   */
  private async keysetPage(
    filter: Filter<ArticleDocument>,
    after: string | undefined,
    limit: number,
  ): Promise<Page<Article>> {
    const scoped = after === undefined ? filter : await this.seekPast(filter, after)
    if (scoped === null) return { items: [], nextCursor: null }

    const docs = await this.articles
      .find(scoped)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray()

    return sliceToPage(docs, limit)
  }

  /**
   * Returns null when the cursor's anchor no longer exists — the article was
   * unpublished mid-scroll. Ending the scroll is safer than silently restarting
   * from the top, which turns an infinite-scroll feed into a loop.
   */
  private async seekPast(
    filter: Filter<ArticleDocument>,
    after: string,
  ): Promise<Filter<ArticleDocument> | null> {
    const anchor = await this.articles.findOne({ _id: after })
    if (anchor === null) return null

    return {
      ...filter,
      $or: [
        { publishedAt: { $lt: anchor.publishedAt } },
        { publishedAt: anchor.publishedAt, _id: { $lt: anchor._id } },
      ],
    }
  }
}

function sliceToPage(docs: readonly ArticleDocument[], limit: number): Page<Article> {
  const page = docs.slice(0, limit)
  const hasMore = docs.length > limit

  return {
    items: page.map(articleToDomain),
    nextCursor: hasMore ? (page.at(-1)?._id ?? null) : null,
  }
}
