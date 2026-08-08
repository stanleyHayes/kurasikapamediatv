import type { Page, SearchHit, SearchPort, SearchQuery } from '@kurasikapa/application'
import type { Collection, Db } from 'mongodb'
import { ARTICLES, type ArticleDocument } from './documents'

interface Scored extends ArticleDocument {
  score: number
}

/**
 * Lexical search on MongoDB's own `$text` index.
 *
 * NOT Atlas Search, deliberately. Atlas Search needs `mongot`, which
 * Community does not ship — so it cannot run in a Testcontainer, and a search
 * adapter that only works in production is one nobody can test. `$text` gives
 * stemming, stop words and relevance scoring, runs everywhere, and is honest
 * about what it is.
 *
 * When relevance matters more than portability, an Atlas Search adapter is a
 * second implementation of this same port and one wiring line. That is what
 * the port is for. See docs/04-data-model.md.
 */
export class MongoTextSearch implements SearchPort {
  private readonly articles: Collection<ArticleDocument>

  constructor(db: Db) {
    this.articles = db.collection<ArticleDocument>(ARTICLES)
  }

  async search(query: SearchQuery): Promise<Page<SearchHit>> {
    const docs = await this.articles
      .aggregate<Scored>([
        {
          $match: {
            $text: { $search: query.terms },
            // Readers must never be shown an unpublished draft by searching
            // for it, and results must not cross languages.
            status: 'published',
            locale: query.locale,
          },
        },
        { $addFields: { score: { $meta: 'textScore' } } },
        // `_id` breaks ties, so pagination is stable across equal scores.
        { $sort: { score: -1, _id: -1 } },
        { $limit: query.limit + 1 },
      ])
      .toArray()

    const page = docs.slice(0, query.limit)
    const hasMore = docs.length > query.limit

    return {
      items: page.map(toHit),
      nextCursor: hasMore ? (page.at(-1)?._id ?? null) : null,
    }
  }
}

const toHit = (doc: Scored): SearchHit => ({
  articleId: doc._id,
  slug: doc.slug,
  title: doc.title,
  locale: doc.locale,
  publishedAt: doc.publishedAt?.toISOString() ?? null,
  score: doc.score,
})
