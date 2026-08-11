import type { RssSourceRepository } from '@kurasikapa/application'
import { RssSource, categoryId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { RSS_SOURCES, type RssSourceDocument } from './documents'

export class MongoRssSourceRepository implements RssSourceRepository {
  private readonly rows: Collection<RssSourceDocument>

  constructor(db: Db) {
    this.rows = db.collection<RssSourceDocument>(RSS_SOURCES)
  }

  async save(source: RssSource): Promise<void> {
    const props = source.snapshot()
    await this.rows.updateOne(
      { _id: props.id },
      {
        $set: {
          url: props.url,
          locale: props.locale,
          categoryId: props.categoryId,
          etag: props.etag,
          lastFetchedAt: props.lastFetchedAt,
          seenGuids: [...props.seenGuids],
        },
      },
      { upsert: true },
    )
  }

  async list(): Promise<readonly RssSource[]> {
    const docs = await this.rows.find().toArray()
    return docs.map(toDomain)
  }
}

const toDomain = (doc: RssSourceDocument): RssSource =>
  RssSource.reconstitute({
    id: doc._id,
    url: doc.url,
    locale: doc.locale,
    categoryId: categoryId(doc.categoryId),
    etag: doc.etag,
    lastFetchedAt: doc.lastFetchedAt,
    seenGuids: doc.seenGuids,
  })
