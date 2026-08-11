import { NewsletterSubscription, type Cadence, normaliseEmail } from '@kurasikapa/domain'
import type { IdPort } from '../ports/ambient'
import type { EmailPort } from '../ports/email'
import type { NewsletterRepository } from '../ports/newsletter-repository'
import type { UseCase } from '../ports/use-case'

export class EmailDeliveryFailed extends Error {
  constructor() {
    super('Confirmation email could not be sent')
    this.name = 'EmailDeliveryFailed'
  }
}

export interface SubscribeNewsletterDeps {
  readonly subscriptions: NewsletterRepository
  readonly email: EmailPort
  readonly ids: IdPort
  readonly siteUrl: string
}

export interface SubscribeNewsletterInput {
  readonly email: string
  readonly locales: readonly string[]
  readonly cadence: Cadence
}

/**
 * Starts a subscription. The address stays pending until the mailed link is
 * opened. Already-confirmed addresses are a no-op so we do not leak who is on
 * the list.
 */
export class SubscribeNewsletter implements UseCase<SubscribeNewsletterInput, { state: string }> {
  constructor(private readonly deps: SubscribeNewsletterDeps) {}

  async execute(input: SubscribeNewsletterInput): Promise<{ state: string }> {
    const email = normaliseEmail(input.email)
    const existing = await this.deps.subscriptions.findByEmail(email)
    if (existing?.state === 'confirmed') return { state: 'confirmed' }

    const token = this.deps.ids.next()
    const next =
      existing === null
        ? NewsletterSubscription.request({
            id: this.deps.ids.next(),
            email,
            locales: input.locales,
            cadence: input.cadence,
            token,
          })
        : existing.retoken(token)

    await this.deps.subscriptions.save(next)
    await this.sendConfirmation(next.email, token, input.locales[0] ?? 'en')

    return { state: 'pending' }
  }

  private async sendConfirmation(to: string, token: string, locale: string): Promise<void> {
    const url = `${this.deps.siteUrl}/${locale}/newsletter/confirm?token=${encodeURIComponent(token)}`
    try {
      await this.deps.email.send({
        to,
        subject: 'Confirm your Kurasikapa briefing',
        text: `Confirm your subscription:\n${url}\n`,
      })
    } catch {
      throw new EmailDeliveryFailed()
    }
  }
}
