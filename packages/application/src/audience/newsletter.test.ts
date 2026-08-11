import { InvalidConfirmation, InvalidEmail } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { FakeClock, SequentialIds } from '../testing/fakes'
import { FailClosedEmail, RecordingEmail } from '../testing/fake-email'
import { InMemoryNewsletterRepository } from '../testing/in-memory-newsletter-repository'
import { ConfirmNewsletter } from './confirm-newsletter'
import { EmailDeliveryFailed, SubscribeNewsletter } from './subscribe-newsletter'
import { UnsubscribeNewsletter } from './unsubscribe-newsletter'

const NOW = new Date('2026-08-11T12:00:00Z')

interface Wiring {
  readonly email: RecordingEmail
  readonly subscriptions: InMemoryNewsletterRepository
  readonly subscribe: SubscribeNewsletter
  readonly confirm: ConfirmNewsletter
  readonly unsubscribe: UnsubscribeNewsletter
}

const wiring = (): Wiring => {
  const subscriptions = new InMemoryNewsletterRepository()
  const email = new RecordingEmail()
  const ids = new SequentialIds('tok')
  return {
    email,
    subscriptions,
    subscribe: new SubscribeNewsletter({
      subscriptions,
      email,
      ids,
      siteUrl: 'http://localhost:3000',
    }),
    confirm: new ConfirmNewsletter(subscriptions, new FakeClock(NOW)),
    unsubscribe: new UnsubscribeNewsletter(subscriptions),
  }
}

describe('SubscribeNewsletter', () => {
  it('stores a pending subscription and mails a confirm link', async () => {
    const { subscribe, email, subscriptions } = wiring()

    const result = await subscribe.execute({
      email: 'Editor@Kurasikapa.tv',
      locales: ['en'],
      cadence: 'daily',
    })

    expect(result.state).toBe('pending')
    expect((await subscriptions.findByEmail('editor@kurasikapa.tv'))?.state).toBe('pending')
    expect(email.sent[0]?.to).toBe('editor@kurasikapa.tv')
    expect(email.sent[0]?.text).toContain('/en/newsletter/confirm?token=')
  })

  it('does not reveal an already-confirmed address', async () => {
    const { subscribe, confirm, email } = wiring()
    await subscribe.execute({ email: 'a@b.co', locales: ['en'], cadence: 'daily' })
    const token = email.sent[0]?.text.match(/token=([^\s]+)/u)?.[1] ?? ''
    await confirm.execute({ token })
    email.sent.length = 0

    const again = await subscribe.execute({ email: 'a@b.co', locales: ['fr'], cadence: 'weekly' })

    expect(again.state).toBe('confirmed')
    expect(email.sent).toHaveLength(0)
  })

  it('fails closed when mail cannot be sent', async () => {
    const subscribe = new SubscribeNewsletter({
      subscriptions: new InMemoryNewsletterRepository(),
      email: new FailClosedEmail(),
      ids: new SequentialIds('tok'),
      siteUrl: 'http://localhost:3000',
    })

    await expect(
      subscribe.execute({ email: 'a@b.co', locales: ['en'], cadence: 'daily' }),
    ).rejects.toThrow(EmailDeliveryFailed)
  })

  it('reissues a token when the address is still pending', async () => {
    const { subscribe, email, subscriptions } = wiring()
    await subscribe.execute({ email: 'a@b.co', locales: ['en'], cadence: 'daily' })
    const first = (await subscriptions.findByEmail('a@b.co'))?.token

    await subscribe.execute({ email: 'a@b.co', locales: ['fr'], cadence: 'weekly' })

    expect((await subscriptions.findByEmail('a@b.co'))?.token).not.toBe(first)
    expect(email.sent).toHaveLength(2)
  })

  it('refuses a non-address', async () => {
    const { subscribe } = wiring()

    await expect(
      subscribe.execute({ email: 'nope', locales: ['en'], cadence: 'daily' }),
    ).rejects.toThrow(InvalidEmail)
  })
})

describe('ConfirmNewsletter', () => {
  it('makes a pending subscription confirmed', async () => {
    const { subscribe, confirm, email, subscriptions } = wiring()
    await subscribe.execute({ email: 'a@b.co', locales: ['en'], cadence: 'daily' })
    const token = email.sent[0]?.text.match(/token=([^\s]+)/u)?.[1] ?? ''

    expect(await confirm.execute({ token })).toEqual({ state: 'confirmed' })
    expect((await subscriptions.findByEmail('a@b.co'))?.state).toBe('confirmed')
  })

  it('refuses an unknown token', async () => {
    const { confirm } = wiring()

    await expect(confirm.execute({ token: 'missing' })).rejects.toThrow(InvalidConfirmation)
  })

  it('refuses a blank token', async () => {
    const { confirm } = wiring()

    await expect(confirm.execute({ token: '  ' })).rejects.toThrow(InvalidConfirmation)
  })
})

describe('UnsubscribeNewsletter', () => {
  it('leaves a confirmed list without erroring on unknown addresses', async () => {
    const { subscribe, confirm, unsubscribe, email } = wiring()
    await subscribe.execute({ email: 'a@b.co', locales: ['en'], cadence: 'daily' })
    const token = email.sent[0]?.text.match(/token=([^\s]+)/u)?.[1] ?? ''
    await confirm.execute({ token })

    expect(await unsubscribe.execute({ email: 'a@b.co' })).toEqual({ state: 'unsubscribed' })
    expect(await unsubscribe.execute({ email: 'nobody@b.co' })).toEqual({ state: 'unsubscribed' })
  })
})
