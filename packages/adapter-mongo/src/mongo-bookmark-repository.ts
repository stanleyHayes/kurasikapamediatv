import type { BookmarkRepository, Cursor, Page } from '@kurasikapa/application'
import { type ArticleId, Bookmark, type UserId, articleId, userId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { BOOKMARKS, type BookmarkDocument } from './documents'

/** Composite id, so a reader cannot save the same article twice. */
const idOf = (reader: string, article: string): string => `${reader}:${article}`

export class MongoBookmarkRepository implements BookmarkRepository {
  private readonly bookmarks: Collection<BookmarkDocument>

  constructor(db: Db) {
    this.bookmarks = db.collection<BookmarkDocument>(BOOKMARKS)
  }

  async listFor(readerId: UserId, cursor: Cursor): Promise<Page<Bookmark>> {
    const filter =
      cursor.after === undefined
        ? { readerId }
        : { readerId, _id: { $lt: cursor.after } }

    const docs = await this.bookmarks
      .find(filter)
      .sort({ savedAt: -1, _id: -1 })
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)
    const hasMore = docs.length > cursor.limit

    return {
      items: page.map(toDomain),
      nextCursor: hasMore ? (page.at(-1)?._id ?? null) : null,
    }
  }

  async isSaved(readerId: UserId, id: ArticleId): Promise<boolean> {
    const found = await this.bookmarks.findOne({ _id: idOf(readerId, id) })
    return found !== null
  }

  async save(bookmark: Bookmark): Promise<void> {
    const props = bookmark.snapshot()

    // Upsert, so saving twice is a no-op rather than a duplicate-key error —
    // the use case promises idempotence and this is where it is kept.
    await this.bookmarks.updateOne(
      { _id: idOf(props.readerId, props.articleId) },
      { $set: { readerId: props.readerId, articleId: props.articleId, locale: props.locale, savedAt: props.savedAt } },
      { upsert: true },
    )
  }

  async remove(readerId: UserId, id: ArticleId): Promise<void> {
    await this.bookmarks.deleteOne({ _id: idOf(readerId, id) })
  }
}

const toDomain = (doc: BookmarkDocument): Bookmark =>
  Bookmark.reconstitute({
    readerId: userId(doc.readerId),
    articleId: articleId(doc.articleId),
    locale: doc.locale,
    savedAt: doc.savedAt,
  })
