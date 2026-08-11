import type { DeviceSubscription } from '@kurasikapa/domain'
import type { PushSubscriptionRepository } from '../ports/push-subscription-repository'

export class InMemoryPushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly rows = new Map<string, DeviceSubscription>()

  save(subscription: DeviceSubscription): Promise<void> {
    this.rows.set(subscription.endpoint, subscription)
    return Promise.resolve()
  }

  remove(endpoint: string): Promise<void> {
    this.rows.delete(endpoint)
    return Promise.resolve()
  }

  listByLocale(locale: string): Promise<readonly DeviceSubscription[]> {
    return Promise.resolve([...this.rows.values()].filter((row) => row.locale === locale))
  }
}
