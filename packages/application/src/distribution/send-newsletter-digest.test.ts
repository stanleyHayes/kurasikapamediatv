import {
  NewsletterSubscription,
  articleId,
  categoryId,
} from '@kurasikapa/domain'
import { anApprovedArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { EmailDeliveryFailed } from '../audience/subscribe-newsletter'
import { FailClosedEmail, RecordingEmail } from '../testing/fake-email'
import { FakeClock } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryNewsletterDigestRepository } from '../testing/in-memory-newsletter-digest-repository'
import { InMemoryNewsletterRepository } from '../testing/in-memory-newsletter-repository'
import { DigestAlreadySent, SendNewsletterDigest } from './send-newsletter-digest'

const NOW = new Date('2026-08-11T19:00:00Z')
const EARLIER = new Date('2026-08-11T10:00:00Z')
const OLD = new Date('2026-08-01T10:00:00Z')
const SINCE = new Date('2026-08-10T19:00:00Z')

const live = (at: Date, id = 'art_1'): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({
    id: articleId(id),
    status: 'published',
    publishedAt: at,
    categoryId: categoryId('cat_news'),
  })

const confirmed = (email: string, cadence: 'daily' | 'weekly' = 'daily'): NewsletterSubscription =>
  NewsletterSubscription.request({
    id: `sub_${email}`,
    email,
    locales: ['en'],
    cadence,
    token: 'tok',
  }).confirm('tok', NOW)

const wiring = (
  articles = [live(EARLIER)],
  email: RecordingEmail | FailClosedEmail = new RecordingEmail(),
): {
  readonly email: RecordingEmail | FailClosedEmail
  readonly digests: InMemoryNewsletterDigestRepository
  readonly subscriptions: InMemoryNewsletterRepository
  readonly send: SendNewsletterDigest
} => {
  const subscriptions = new InMemoryNewsletterRepository()
  const digests = new InMemoryNewsletterDigestRepository()
  return {
    email,
    digests,
    subscriptions,
    send: new SendNewsletterDigest({
      articles: new InMemoryArticleRepository(articles),
      subscriptions,
      digests,
      email,
      clock: new FakeClock(NOW),
      siteUrl: 'http://localhost:3000',
    }),
  }
}

const daily = {
  cadence: 'daily' as const,
  locale: 'en',
  periodKey: '2026-08-11',
  since: SINCE,
}

describe('SendNewsletterDigest', () => {
  it('mails daily subscribers the stories in the window', async () => {
    const { send, email, subscriptions } = wiring()
    await subscriptions.save(confirmed('a@b.co', 'daily'))
    await subscriptions.save(confirmed('w@b.co', 'weekly'))

    const result = await send.execute(daily)

    expect(result).toEqual({ sent: 1, articles: 1 })
    expect(email instanceof RecordingEmail && email.sent).toHaveLength(1)
    if (email instanceof RecordingEmail) {
      expect(email.sent[0]?.to).toBe('a@b.co')
      expect(email.sent[0]?.text).toContain('/en/articles/')
    }
  })

  it('skips mailing when the window is empty but still latches', async () => {
    const { send, email, subscriptions } = wiring([live(OLD)])
    await subscriptions.save(confirmed('a@b.co'))

    expect(await send.execute(daily)).toEqual({ sent: 0, articles: 0 })
    expect(email instanceof RecordingEmail && email.sent).toHaveLength(0)
    await expect(send.execute(daily)).rejects.toThrow(DigestAlreadySent)
  })

  it('refuses a second send for the same period', async () => {
    const { send, subscriptions } = wiring()
    await subscriptions.save(confirmed('a@b.co'))

    await send.execute(daily)
    await expect(send.execute(daily)).rejects.toThrow(DigestAlreadySent)
  })

  it('fails closed when the mailer is unset', async () => {
    const { send, subscriptions } = wiring([live(EARLIER)], new FailClosedEmail())
    await subscriptions.save(confirmed('a@b.co'))

    await expect(send.execute(daily)).rejects.toThrow(EmailDeliveryFailed)
  })
})
