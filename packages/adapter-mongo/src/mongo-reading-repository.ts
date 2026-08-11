import type { Cursor, Page, ReadingRepository } from '@kurasikapa/application'
import { Reading, type UserId, articleId, userId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { READINGS, type ReadingDocument } from './documents'

const idOf = (reader: string, article: string): string => `${reader}:${article}`

export class MongoReadingRepository implements ReadingRepository {
  private readonly readings: Collection<ReadingDocument>

  constructor(db: Db) {
    this.readings = db.collection<ReadingDocument>(READINGS)
  }

  async listFor(readerId: UserId, cursor: Cursor): Promise<Page<Reading>> {
    const filter =
      cursor.after === undefined
        ? { readerId }
        : { readerId, _id: { $lt: cursor.after } }

    const docs = await this.readings
      .find(filter)
      .sort({ readAt: -1, _id: -1 })
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)
    return {
      items: page.map(toDomain),
      nextCursor: docs.length > cursor.limit ? (page.at(-1)?._id ?? null) : null,
    }
  }

  async save(reading: Reading): Promise<void> {
    const props = reading.snapshot()
    await this.readings.updateOne(
      { _id: idOf(props.readerId, props.articleId) },
      {
        $set: {
          readerId: props.readerId,
          articleId: props.articleId,
          locale: props.locale,
          readAt: props.readAt,
        },
      },
      { upsert: true },
    )
  }

  async countFor(readerId: UserId): Promise<number> {
    return this.readings.countDocuments({ readerId })
  }
}

const toDomain = (doc: ReadingDocument): Reading =>
  Reading.reconstitute({
    readerId: userId(doc.readerId),
    articleId: articleId(doc.articleId),
    locale: doc.locale,
    readAt: doc.readAt,
  })
