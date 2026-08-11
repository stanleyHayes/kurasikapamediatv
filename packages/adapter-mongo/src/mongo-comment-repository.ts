import type { CommentRepository, Cursor, Page } from '@kurasikapa/application'
import {
  Comment,
  type ArticleId,
  type CommentId,
  type CommentState,
  articleId,
  commentId,
  userId,
} from '@kurasikapa/domain'
import type { Collection, Db, Filter } from 'mongodb'
import { COMMENTS, type CommentDocument } from './documents'

export class MongoCommentRepository implements CommentRepository {
  private readonly comments: Collection<CommentDocument>

  constructor(db: Db) {
    this.comments = db.collection<CommentDocument>(COMMENTS)
  }

  async findById(id: CommentId): Promise<Comment | null> {
    const doc = await this.comments.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async listVisible(articleId: ArticleId, cursor: Cursor): Promise<Page<Comment>> {
    return this.page({ articleId, state: 'visible' }, cursor, { createdAt: -1, _id: -1 })
  }

  async listPending(cursor: Cursor): Promise<Page<Comment>> {
    return this.page({ state: 'pending' }, cursor, { createdAt: 1, _id: 1 })
  }

  async save(comment: Comment): Promise<void> {
    const props = comment.snapshot()
    await this.comments.updateOne(
      { _id: props.id },
      {
        $set: {
          articleId: props.articleId,
          readerId: props.readerId,
          body: props.body,
          state: props.state,
          createdAt: props.createdAt,
        },
      },
      { upsert: true },
    )
  }

  private async page(
    match: Filter<CommentDocument>,
    cursor: Cursor,
    sort: Record<string, 1 | -1>,
  ): Promise<Page<Comment>> {
    const afterOp = sort['createdAt'] === 1 ? '$gt' : '$lt'
    const filter: Filter<CommentDocument> =
      cursor.after === undefined ? match : { ...match, _id: { [afterOp]: cursor.after } }

    const docs = await this.comments
      .find(filter)
      .sort(sort)
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)
    return {
      items: page.map(toDomain),
      nextCursor: docs.length > cursor.limit ? (page.at(-1)?._id ?? null) : null,
    }
  }
}

function asState(value: string): CommentState {
  if (value === 'pending' || value === 'visible' || value === 'rejected') return value
  throw new Error(`Unknown comment state ${value}`)
}

const toDomain = (doc: CommentDocument): Comment =>
  Comment.reconstitute({
    id: commentId(doc._id),
    articleId: articleId(doc.articleId),
    readerId: userId(doc.readerId),
    body: doc.body,
    state: asState(doc.state),
    createdAt: doc.createdAt,
  })
