import { describe, expect, it } from 'vitest'
import { InvalidDigestLocale, NewsletterDigest } from './newsletter-digest'

const NOW = new Date('2026-08-11T19:00:00Z')

describe('NewsletterDigest.issue', () => {
  it('latches on cadence, locale and period', () => {
    const digest = NewsletterDigest.issue({
      cadence: 'daily',
      locale: 'en',
      periodKey: '2026-08-11',
      now: NOW,
      articleCount: 3,
      recipientCount: 12,
    })

    expect(digest.id).toBe('daily:en:2026-08-11')
    expect(NewsletterDigest.reconstitute(digest.snapshot()).id).toBe(digest.id)
  })

  it('refuses a short locale', () => {
    expect(() =>
      NewsletterDigest.issue({
        cadence: 'weekly',
        locale: 'x',
        periodKey: '2026-W33',
        now: NOW,
        articleCount: 0,
        recipientCount: 0,
      }),
    ).toThrow(InvalidDigestLocale)
  })
})
