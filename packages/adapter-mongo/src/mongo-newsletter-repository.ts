import type { NewsletterRepository } from '@kurasikapa/application'
import {
  NewsletterSubscription,
  type Cadence,
  type NewsletterState,
} from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { NEWSLETTER_SUBSCRIBERS, type NewsletterDocument } from './documents'

export class MongoNewsletterRepository implements NewsletterRepository {
  private readonly rows: Collection<NewsletterDocument>

  constructor(db: Db) {
    this.rows = db.collection<NewsletterDocument>(NEWSLETTER_SUBSCRIBERS)
  }

  async findByEmail(email: string): Promise<NewsletterSubscription | null> {
    const doc = await this.rows.findOne({ email })
    return doc === null ? null : toDomain(doc)
  }

  async findByToken(token: string): Promise<NewsletterSubscription | null> {
    const doc = await this.rows.findOne({ token })
    return doc === null ? null : toDomain(doc)
  }

  async listConfirmed(locale: string): Promise<readonly NewsletterSubscription[]> {
    const docs = await this.rows.find({ state: 'confirmed', locales: locale }).toArray()
    return docs.map(toDomain)
  }

  async save(subscription: NewsletterSubscription): Promise<void> {
    const props = subscription.snapshot()
    await this.rows.updateOne(
      { email: props.email },
      {
        $set: {
          email: props.email,
          locales: [...props.locales],
          cadence: props.cadence,
          state: props.state,
          token: props.token,
          confirmedAt: props.confirmedAt,
        },
        $setOnInsert: { _id: props.id },
      },
      { upsert: true },
    )
  }
}

function toDomain(doc: NewsletterDocument): NewsletterSubscription {
  return NewsletterSubscription.reconstitute({
    id: doc._id,
    email: doc.email,
    locales: doc.locales,
    cadence: doc.cadence as Cadence,
    state: doc.state as NewsletterState,
    token: doc.token,
    confirmedAt: doc.confirmedAt,
  })
}
