import type { DeviceSubscription } from '@kurasikapa/domain'

export interface PushSubscriptionRepository {
  save(subscription: DeviceSubscription): Promise<void>
  remove(endpoint: string): Promise<void>
  listByLocale(locale: string): Promise<readonly DeviceSubscription[]>
}
