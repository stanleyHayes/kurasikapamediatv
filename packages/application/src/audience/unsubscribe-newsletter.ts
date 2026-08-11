import { normaliseEmail } from '@kurasikapa/domain'
import type { NewsletterRepository } from '../ports/newsletter-repository'
import type { UseCase } from '../ports/use-case'

export class UnsubscribeNewsletter implements UseCase<{ email: string }, { state: string }> {
  constructor(private readonly subscriptions: NewsletterRepository) {}

  async execute(input: { email: string }): Promise<{ state: string }> {
    const email = normaliseEmail(input.email)
    const found = await this.subscriptions.findByEmail(email)
    if (found === null) return { state: 'unsubscribed' }

    const next = found.unsubscribe()
    await this.subscriptions.save(next)

    return { state: next.state }
  }
}
