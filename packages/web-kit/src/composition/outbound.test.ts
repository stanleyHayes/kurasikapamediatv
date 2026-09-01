import { afterEach, describe, expect, it } from 'vitest'
import { DeviceSubscription } from '@kurasikapa/domain'
import { emailFromAddress, failClosedEmail, failClosedPush, newsroomAddress } from './outbound'

describe('outbound adapters', () => {
  afterEach(() => {
    delete process.env['CONTACT_TO_EMAIL']
    delete process.env['EMAIL_FROM']
  })

  it('refuses mail when Resend is unset', async () => {
    await expect(
      failClosedEmail().send({ to: 'a@b.co', subject: 'x', text: 'y' }),
    ).rejects.toThrow(/RESEND_API_KEY/u)
  })

  it('defaults the contact inbox to the Yahoo newsroom', () => {
    expect(newsroomAddress()).toBe('kurasikapamediatv@yahoo.com')
  })

  it('honours CONTACT_TO_EMAIL when set', () => {
    process.env['CONTACT_TO_EMAIL'] = 'desk@example.com'
    expect(newsroomAddress()).toBe('desk@example.com')
  })

  it('uses a verified EMAIL_FROM override when supplied', () => {
    expect(emailFromAddress()).toBe('Kurasikapa Media <news@kurasikapa.tv>')
    process.env['EMAIL_FROM'] = 'Kurasikapa News <desk@example.com>'
    expect(emailFromAddress()).toBe('Kurasikapa News <desk@example.com>')
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
