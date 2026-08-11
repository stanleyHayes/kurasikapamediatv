import type { PushSubscriptionRepository } from '../ports/push-subscription-repository'
import type { UseCase } from '../ports/use-case'

export class UnsubscribePush implements UseCase<{ endpoint: string }, { removed: true }> {
  constructor(private readonly devices: PushSubscriptionRepository) {}

  async execute(input: { endpoint: string }): Promise<{ removed: true }> {
    await this.devices.remove(input.endpoint.trim())
    return { removed: true }
  }
}
