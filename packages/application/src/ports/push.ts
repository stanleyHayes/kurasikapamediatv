import type { DeviceSubscription } from '@kurasikapa/domain'

export interface PushMessage {
  readonly title: string
  readonly body: string
  readonly url: string
}

/**
 * Web Push. Fail-closed when VAPID keys are unset — a "sent" notification
 * that never left the building is how readers stop trusting alerts.
 */
export interface PushPort {
  send(device: DeviceSubscription, message: PushMessage): Promise<void>
}
