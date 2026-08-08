import type { Cursor, Page, SocialPostRepository } from '@kurasikapa/application'
import {
  type Platform,
  type PostState,
  SocialPost,
  type SocialPostId,
  articleId,
  socialPostId,
  userId,
} from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { SOCIAL_POSTS, type SocialPostDocument } from './documents'

export class MongoSocialPostRepository implements SocialPostRepository {
  private readonly posts: Collection<SocialPostDocument>

  constructor(db: Db) {
    this.posts = db.collection<SocialPostDocument>(SOCIAL_POSTS)
  }

  async findById(id: SocialPostId): Promise<SocialPost | null> {
    const doc = await this.posts.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async listQueue(cursor: Cursor): Promise<Page<SocialPost>> {
    const filter = cursor.after === undefined ? {} : { _id: { $gt: cursor.after } }

    const docs = await this.posts
      .find(filter)
      .sort({ scheduledAt: 1, _id: 1 })
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)

    return {
      items: page.map(toDomain),
      nextCursor: docs.length > cursor.limit ? (page.at(-1)?._id ?? null) : null,
    }
  }

  async listDue(now: Date): Promise<readonly SocialPost[]> {
    // Only `queued` — a post that exhausted its retries is `failed` and must
    // stay out of the worker's way until a person looks at it.
    const docs = await this.posts
      .find({ state: 'queued', scheduledAt: { $lte: now } })
      .sort({ scheduledAt: 1 })
      .toArray()

    return docs.map(toDomain)
  }

  async save(post: SocialPost): Promise<void> {
    const props = post.snapshot()
    const { id, ...rest } = props

    await this.posts.updateOne({ _id: id }, { $set: rest }, { upsert: true })
  }
}

const toDomain = (doc: SocialPostDocument): SocialPost =>
  SocialPost.reconstitute({
    id: socialPostId(doc._id),
    articleId: articleId(doc.articleId),
    platform: doc.platform as Platform,
    caption: doc.caption,
    scheduledAt: doc.scheduledAt,
    state: doc.state as PostState,
    attempts: doc.attempts,
    lastError: doc.lastError,
    createdBy: userId(doc.createdBy),
  })
