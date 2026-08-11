import { describe, expect, it } from 'vitest'
import { DeviceSubscription, InvalidPushEndpoint, InvalidPushKey } from './device-subscription'

const NOW = new Date('2026-08-11T18:00:00Z')
const draft = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  p256dh: 'key',
  auth: 'secret',
  locale: 'en',
  now: NOW,
}

describe('DeviceSubscription.subscribe', () => {
  it('stores an https endpoint and locale', () => {
    const row = DeviceSubscription.subscribe(draft)

    expect(row.endpoint).toBe(draft.endpoint)
    expect(row.locale).toBe('en')
    expect(row.snapshot().subscribedAt).toEqual(NOW)
    expect(DeviceSubscription.reconstitute(row.snapshot()).endpoint).toBe(row.endpoint)
  })

  it('refuses a non-https endpoint', () => {
    expect(() => DeviceSubscription.subscribe({ ...draft, endpoint: 'http://insecure' })).toThrow(
      InvalidPushEndpoint,
    )
  })

  it('refuses empty keys', () => {
    expect(() => DeviceSubscription.subscribe({ ...draft, p256dh: '  ' })).toThrow(InvalidPushKey)
    expect(() => DeviceSubscription.subscribe({ ...draft, auth: '' })).toThrow(InvalidPushKey)
  })

  it('refuses a short locale or a non-url', () => {
    expect(() => DeviceSubscription.subscribe({ ...draft, locale: 'x' })).toThrow(
      InvalidPushEndpoint,
    )
    expect(() => DeviceSubscription.subscribe({ ...draft, endpoint: 'not-a-url' })).toThrow(
      InvalidPushEndpoint,
    )
  })
})
