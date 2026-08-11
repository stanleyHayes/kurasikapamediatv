import type { PushMessage, PushPort } from '@kurasikapa/application'
import type { DeviceSubscription } from '@kurasikapa/domain'
import { vapidHeader, type VapidKeys } from './vapid'

export interface WebPushConfig {
  readonly publicKey: string | undefined
  readonly privateKey: string | undefined
  readonly subject: string
  readonly post: typeof fetch
}

/**
 * Web Push. Unset VAPID keys fail closed. Configured keys sign an empty-body
 * POST — the service worker shows a generic breaking notice until payload
 * encryption is added.
 */
export class WebPushSender implements PushPort {
  constructor(private readonly config: WebPushConfig) {}

  async send(device: DeviceSubscription, _message: PushMessage): Promise<void> {
    const keys = this.keys()
    const response = await this.config.post(device.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400',
        Authorization: vapidHeader(device.endpoint, keys, new Date()),
      },
    })

    if (!response.ok && response.status !== 201) {
      throw new Error(`Web Push ${String(response.status)}`)
    }
  }

  private keys(): VapidKeys {
    const { publicKey, privateKey, subject } = this.config
    if (!present(publicKey) || !present(privateKey)) {
      throw new Error('Push is not configured: VAPID keys are unset')
    }

    return { publicKey, privateKey, subject }
  }
}

function present(value: string | undefined): value is string {
  return value !== undefined && value !== ''
}
