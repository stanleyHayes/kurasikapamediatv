import type { NewsletterDigestRepository } from '@kurasikapa/application'
import { NewsletterDigest, type Cadence } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { NEWSLETTER_DIGESTS, type NewsletterDigestDocument } from './documents'

export class MongoNewsletterDigestRepository implements NewsletterDigestRepository {
  private readonly rows: Collection<NewsletterDigestDocument>

  constructor(db: Db) {
    this.rows = db.collection<NewsletterDigestDocument>(NEWSLETTER_DIGESTS)
  }

  async findById(id: string): Promise<NewsletterDigest | null> {
    const doc = await this.rows.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async save(digest: NewsletterDigest): Promise<void> {
    const props = digest.snapshot()
    await this.rows.insertOne({
      _id: props.id,
      cadence: props.cadence,
      locale: props.locale,
      periodKey: props.periodKey,
      sentAt: props.sentAt,
      articleCount: props.articleCount,
      recipientCount: props.recipientCount,
    })
  }
}

const toDomain = (doc: NewsletterDigestDocument): NewsletterDigest =>
  NewsletterDigest.reconstitute({
    id: doc._id,
    cadence: doc.cadence as Cadence,
    locale: doc.locale,
    periodKey: doc.periodKey,
    sentAt: doc.sentAt,
    articleCount: doc.articleCount,
    recipientCount: doc.recipientCount,
  })
