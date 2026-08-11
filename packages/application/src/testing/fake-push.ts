import type { DeviceSubscription } from '@kurasikapa/domain'
import type { PushMessage, PushPort } from '../ports/push'

export class RecordingPush implements PushPort {
  readonly sent: { readonly endpoint: string; readonly message: PushMessage }[] = []

  send(device: DeviceSubscription, message: PushMessage): Promise<void> {
    this.sent.push({ endpoint: device.endpoint, message })
    return Promise.resolve()
  }
}

export class FailClosedPush implements PushPort {
  send(): Promise<void> {
    return Promise.reject(new Error('Push is not configured: VAPID keys are unset'))
  }
}
