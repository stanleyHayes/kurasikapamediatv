import type { BreakingAlertRepository } from '@kurasikapa/application'
import { BreakingAlert, articleId, userId, type ArticleId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { BREAKING_ALERTS, type BreakingAlertDocument } from './documents'

export class MongoBreakingAlertRepository implements BreakingAlertRepository {
  private readonly rows: Collection<BreakingAlertDocument>

  constructor(db: Db) {
    this.rows = db.collection<BreakingAlertDocument>(BREAKING_ALERTS)
  }

  async findByArticleId(id: ArticleId): Promise<BreakingAlert | null> {
    const doc = await this.rows.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async save(alert: BreakingAlert): Promise<void> {
    const props = alert.snapshot()
    await this.rows.insertOne({
      _id: props.articleId,
      locale: props.locale,
      actorId: props.actorId,
      sentAt: props.sentAt,
    })
  }
}

const toDomain = (doc: BreakingAlertDocument): BreakingAlert =>
  BreakingAlert.reconstitute({
    articleId: articleId(doc._id),
    locale: doc.locale,
    actorId: userId(doc.actorId),
    sentAt: doc.sentAt,
  })
