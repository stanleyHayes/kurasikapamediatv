import { describe, expect, it } from 'vitest'
import {
  EmptyLocales,
  InvalidConfirmation,
  InvalidEmail,
  NewsletterSubscription,
} from './newsletter'

const NOW = new Date('2026-08-11T12:00:00Z')
const draft = {
  id: 'sub_1',
  email: '  Editor@Kurasikapa.tv ',
  locales: ['en'] as const,
  cadence: 'daily' as const,
  token: 'tok_1',
}

describe('NewsletterSubscription.request', () => {
  it('starts pending with a normalised address', () => {
    const sub = NewsletterSubscription.request(draft)

    expect(sub.state).toBe('pending')
    expect(sub.email).toBe('editor@kurasikapa.tv')
    expect(NewsletterSubscription.reconstitute(sub.snapshot()).id).toBe('sub_1')
  })

  it('refuses an empty locale list', () => {
    expect(() => NewsletterSubscription.request({ ...draft, locales: [] })).toThrow(EmptyLocales)
  })

  it('refuses a non-address', () => {
    expect(() => NewsletterSubscription.request({ ...draft, email: 'not-an-email' })).toThrow(
      InvalidEmail,
    )
  })
})

describe('confirmation', () => {
  it('confirms with the matching token', () => {
    const confirmed = NewsletterSubscription.request(draft).confirm('tok_1', NOW)

    expect(confirmed.state).toBe('confirmed')
    expect(confirmed.token).toBeNull()
    expect(confirmed.snapshot().confirmedAt).toEqual(NOW)
  })

  it('refuses a wrong token', () => {
    expect(() => NewsletterSubscription.request(draft).confirm('tok_other', NOW)).toThrow(
      InvalidConfirmation,
    )
  })

  it('can leave after confirming', () => {
    expect(NewsletterSubscription.request(draft).confirm('tok_1', NOW).unsubscribe().state).toBe(
      'unsubscribed',
    )
  })

  it('reopens a pending token without leaking the old one', () => {
    const next = NewsletterSubscription.request(draft).retoken('tok_2')

    expect(next.state).toBe('pending')
    expect(next.token).toBe('tok_2')
    expect(next.id).toBe('sub_1')
  })

  it('refuses to confirm after leaving', () => {
    expect(() =>
      NewsletterSubscription.request(draft).unsubscribe().confirm('tok_1', NOW),
    ).toThrow(InvalidConfirmation)
  })
})
