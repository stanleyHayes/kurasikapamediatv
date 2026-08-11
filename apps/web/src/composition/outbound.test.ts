import { describe, expect, it } from 'vitest'
import { DeviceSubscription } from '@kurasikapa/domain'
import { failClosedEmail, failClosedPush } from './outbound'

describe('outbound adapters', () => {
  it('refuses mail when Resend is unset', async () => {
    await expect(
      failClosedEmail().send({ to: 'a@b.co', subject: 'x', text: 'y' }),
    ).rejects.toThrow(/RESEND_API_KEY/u)
  })

  it('refuses push when VAPID keys are unset', async () => {
    const device = DeviceSubscription.subscribe({
      endpoint: 'https://push.example/send/x',
      p256dh: 'k',
      auth: 'a',
      locale: 'en',
      now: new Date('2026-08-11T18:00:00Z'),
    })

    await expect(
      failClosedPush().send(device, { title: 't', body: 'b', url: '/' }),
    ).rejects.toThrow(/VAPID/u)
  })
})
