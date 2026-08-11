import type { PushSubscriptionRepository } from '@kurasikapa/application'
import { DeviceSubscription } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { PUSH_SUBSCRIPTIONS, type PushSubscriptionDocument } from './documents'

export class MongoPushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly rows: Collection<PushSubscriptionDocument>

  constructor(db: Db) {
    this.rows = db.collection<PushSubscriptionDocument>(PUSH_SUBSCRIPTIONS)
  }

  async save(subscription: DeviceSubscription): Promise<void> {
    const props = subscription.snapshot()
    await this.rows.updateOne(
      { _id: props.endpoint },
      {
        $set: {
          p256dh: props.p256dh,
          auth: props.auth,
          locale: props.locale,
          subscribedAt: props.subscribedAt,
        },
      },
      { upsert: true },
    )
  }

  async remove(endpoint: string): Promise<void> {
    await this.rows.deleteOne({ _id: endpoint })
  }

  async listByLocale(locale: string): Promise<readonly DeviceSubscription[]> {
    const docs = await this.rows.find({ locale }).toArray()
    return docs.map(toDomain)
  }
}

const toDomain = (doc: PushSubscriptionDocument): DeviceSubscription =>
  DeviceSubscription.reconstitute({
    endpoint: doc._id,
    p256dh: doc.p256dh,
    auth: doc.auth,
    locale: doc.locale,
    subscribedAt: doc.subscribedAt,
  })
