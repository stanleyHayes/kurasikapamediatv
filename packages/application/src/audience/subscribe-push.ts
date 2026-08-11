import { DeviceSubscription } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { PushSubscriptionRepository } from '../ports/push-subscription-repository'
import type { UseCase } from '../ports/use-case'

export interface SubscribePushInput {
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly locale: string
}

export class SubscribePush implements UseCase<SubscribePushInput, { endpoint: string }> {
  constructor(
    private readonly devices: PushSubscriptionRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: SubscribePushInput): Promise<{ endpoint: string }> {
    const subscription = DeviceSubscription.subscribe({ ...input, now: this.clock.now() })
    await this.devices.save(subscription)
    return { endpoint: subscription.endpoint }
  }
}
