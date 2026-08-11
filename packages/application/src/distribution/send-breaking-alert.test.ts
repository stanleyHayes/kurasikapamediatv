import {
  Actor,
  CannotAlertUnpublished,
  DeviceSubscription,
  NewsletterSubscription,
  NotPermitted,
  articleId,
  userId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ConfirmNewsletter } from '../audience/confirm-newsletter'
import { EmailDeliveryFailed, SubscribeNewsletter } from '../audience/subscribe-newsletter'
import { ArticleNotFound } from '../editorial/errors'
import { FailClosedEmail, RecordingEmail } from '../testing/fake-email'
import { FailClosedPush, RecordingPush } from '../testing/fake-push'
import { FakeClock, SequentialIds } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryBreakingAlertRepository } from '../testing/in-memory-breaking-alert-repository'
import { InMemoryNewsletterRepository } from '../testing/in-memory-newsletter-repository'
import { InMemoryPushSubscriptionRepository } from '../testing/in-memory-push-subscription-repository'
import { BreakingAlertAlreadySent, SendBreakingAlert } from './send-breaking-alert'

const NOW = new Date('2026-08-11T12:00:00Z')
const EDITOR = new Actor(userId('usr_editor'), ['editor'])
const AUTHOR = new Actor(userId('usr_author'), ['author'])

const live = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const wiring = (
  articles = [live()],
): {
  readonly email: RecordingEmail
  readonly push: RecordingPush
  readonly devices: InMemoryPushSubscriptionRepository
  readonly send: SendBreakingAlert
  readonly confirm: ConfirmNewsletter
  readonly subscribe: SubscribeNewsletter
} => {
  const subscriptions = new InMemoryNewsletterRepository()
  const devices = new InMemoryPushSubscriptionRepository()
  const email = new RecordingEmail()
  const push = new RecordingPush()
  const ids = new SequentialIds('tok')
  return {
    email,
    push,
    devices,
    subscribe: new SubscribeNewsletter({
      subscriptions,
      email,
      ids,
      siteUrl: 'http://localhost:3000',
    }),
    confirm: new ConfirmNewsletter(subscriptions, new FakeClock(NOW)),
    send: new SendBreakingAlert({
      articles: new InMemoryArticleRepository(articles),
      subscriptions,
      alerts: new InMemoryBreakingAlertRepository(),
      email,
      devices,
      push,
      clock: new FakeClock(NOW),
      siteUrl: 'http://localhost:3000',
    }),
  }
}

describe('SendBreakingAlert', () => {
  it('mails confirmed subscribers in the article locale', async () => {
    const { subscribe, confirm, send, email } = wiring()
    await subscribe.execute({ email: 'a@b.co', locales: ['en'], cadence: 'daily' })
    const token = email.sent[0]?.text.match(/token=([^\s]+)/u)?.[1] ?? ''
    await confirm.execute({ token })
    email.sent.length = 0

    const result = await send.execute({ actor: EDITOR, articleId: articleId('art_1') })

    expect(result.sent).toBe(1)
    expect(email.sent[0]?.to).toBe('a@b.co')
    expect(email.sent[0]?.subject).toContain('Breaking:')
    expect(email.sent[0]?.text).toContain('/en/articles/budget-2026')
  })

  it('skips pending and other-locale addresses', async () => {
    const { subscribe, confirm, send, email } = wiring()
    await subscribe.execute({ email: 'pending@b.co', locales: ['en'], cadence: 'daily' })
    email.sent.length = 0
    await subscribe.execute({ email: 'fr@b.co', locales: ['fr'], cadence: 'daily' })
    const token = email.sent[0]?.text.match(/token=([^\s]+)/u)?.[1] ?? ''
    await confirm.execute({ token })
    email.sent.length = 0

    expect(await send.execute({ actor: EDITOR, articleId: articleId('art_1') })).toEqual({
      sent: 0,
    })
    expect(email.sent).toHaveLength(0)
  })

  it('refuses a second blast for the same article', async () => {
    const { send } = wiring()

    await send.execute({ actor: EDITOR, articleId: articleId('art_1') })
    await expect(send.execute({ actor: EDITOR, articleId: articleId('art_1') })).rejects.toThrow(
      BreakingAlertAlreadySent,
    )
  })

  it('refuses unpublished copy and missing ids', async () => {
    await expect(
      wiring([anArticle()]).send.execute({ actor: EDITOR, articleId: articleId('art_1') }),
    ).rejects.toThrow(CannotAlertUnpublished)

    await expect(
      wiring([]).send.execute({ actor: EDITOR, articleId: articleId('art_1') }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('refuses an author', async () => {
    await expect(
      wiring().send.execute({ actor: AUTHOR, articleId: articleId('art_1') }),
    ).rejects.toThrow(NotPermitted)
  })

  it('fails closed when the mailer is unset', async () => {
    const subscriptions = new InMemoryNewsletterRepository()
    await subscriptions.save(
      NewsletterSubscription.request({
        id: 'sub_1',
        email: 'a@b.co',
        locales: ['en'],
        cadence: 'daily',
        token: 'tok_1',
      }).confirm('tok_1', NOW),
    )

    const send = new SendBreakingAlert({
      articles: new InMemoryArticleRepository([live()]),
      subscriptions,
      alerts: new InMemoryBreakingAlertRepository(),
      email: new FailClosedEmail(),
      devices: new InMemoryPushSubscriptionRepository(),
      push: new RecordingPush(),
      clock: new FakeClock(NOW),
      siteUrl: 'http://localhost:3000',
    })

    await expect(send.execute({ actor: EDITOR, articleId: articleId('art_1') })).rejects.toThrow(
      EmailDeliveryFailed,
    )
  })

  it('wakes devices subscribed in this locale', async () => {
    const { send, devices, push } = wiring()
    await devices.save(
      DeviceSubscription.subscribe({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        p256dh: 'k',
        auth: 'a',
        locale: 'en',
        now: NOW,
      }),
    )

    await send.execute({ actor: EDITOR, articleId: articleId('art_1') })

    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.message.url).toContain('/en/articles/budget-2026')
  })

  it('still latches when push is unset', async () => {
    const devices = new InMemoryPushSubscriptionRepository()
    await devices.save(
      DeviceSubscription.subscribe({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        p256dh: 'k',
        auth: 'a',
        locale: 'en',
        now: NOW,
      }),
    )
    const send = new SendBreakingAlert({
      articles: new InMemoryArticleRepository([live()]),
      subscriptions: new InMemoryNewsletterRepository(),
      alerts: new InMemoryBreakingAlertRepository(),
      email: new RecordingEmail(),
      devices,
      push: new FailClosedPush(),
      clock: new FakeClock(NOW),
      siteUrl: 'http://localhost:3000',
    })

    await send.execute({ actor: EDITOR, articleId: articleId('art_1') })
    await expect(send.execute({ actor: EDITOR, articleId: articleId('art_1') })).rejects.toThrow(
      BreakingAlertAlreadySent,
    )
  })
})
