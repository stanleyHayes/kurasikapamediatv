import type { LikeRepository } from '@kurasikapa/application'
import { type ArticleId, type Like, type UserId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { LIKES, type LikeDocument } from './documents'

const idOf = (reader: string, article: string): string => `${reader}:${article}`

export class MongoLikeRepository implements LikeRepository {
  private readonly likes: Collection<LikeDocument>

  constructor(db: Db) {
    this.likes = db.collection<LikeDocument>(LIKES)
  }

  async isLiked(readerId: UserId, id: ArticleId): Promise<boolean> {
    const found = await this.likes.findOne({ _id: idOf(readerId, id) })
    return found !== null
  }

  async countFor(id: ArticleId): Promise<number> {
    return this.likes.countDocuments({ articleId: id })
  }

  async save(like: Like): Promise<void> {
    const props = like.snapshot()
    await this.likes.updateOne(
      { _id: idOf(props.readerId, props.articleId) },
      {
        $set: {
          readerId: props.readerId,
          articleId: props.articleId,
          likedAt: props.likedAt,
        },
      },
      { upsert: true },
    )
  }

  async remove(readerId: UserId, id: ArticleId): Promise<void> {
    await this.likes.deleteOne({ _id: idOf(readerId, id) })
  }
}