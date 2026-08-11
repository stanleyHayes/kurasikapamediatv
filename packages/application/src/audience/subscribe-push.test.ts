import { DeviceSubscription } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { FakeClock } from '../testing/fakes'
import { InMemoryPushSubscriptionRepository } from '../testing/in-memory-push-subscription-repository'
import { SubscribePush } from './subscribe-push'
import { UnsubscribePush } from './unsubscribe-push'

const NOW = new Date('2026-08-11T18:00:00Z')
const endpoint = 'https://fcm.googleapis.com/fcm/send/abc'

const wiring = (): {
  readonly devices: InMemoryPushSubscriptionRepository
  readonly subscribe: SubscribePush
  readonly unsubscribe: UnsubscribePush
} => {
  const devices = new InMemoryPushSubscriptionRepository()
  return {
    devices,
    subscribe: new SubscribePush(devices, new FakeClock(NOW)),
    unsubscribe: new UnsubscribePush(devices),
  }
}

describe('SubscribePush', () => {
  it('stores a device for that locale', async () => {
    const { subscribe, devices } = wiring()

    await subscribe.execute({ endpoint, p256dh: 'k', auth: 'a', locale: 'en' })

    expect((await devices.listByLocale('en')).map((row) => row.endpoint)).toEqual([endpoint])
    expect(await devices.listByLocale('fr')).toEqual([])
  })

  it('drops the endpoint on unsubscribe', async () => {
    const { subscribe, unsubscribe, devices } = wiring()
    await subscribe.execute({ endpoint, p256dh: 'k', auth: 'a', locale: 'en' })

    await unsubscribe.execute({ endpoint })

    expect(await devices.listByLocale('en')).toEqual([])
  })

  it('refuses a non-https endpoint', async () => {
    await expect(
      wiring().subscribe.execute({
        endpoint: 'http://insecure.example/push',
        p256dh: 'k',
        auth: 'a',
        locale: 'en',
      }),
    ).rejects.toThrow()
  })
})

describe('DeviceSubscription round-trip', () => {
  it('reconstitutes what subscribe wrote', () => {
    const row = DeviceSubscription.subscribe({
      endpoint,
      p256dh: 'k',
      auth: 'a',
      locale: 'fr',
      now: NOW,
    })
    expect(DeviceSubscription.reconstitute(row.snapshot()).locale).toBe('fr')
  })
})
