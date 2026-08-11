import { InvalidConfirmation } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { NewsletterRepository } from '../ports/newsletter-repository'
import type { UseCase } from '../ports/use-case'

export class ConfirmNewsletter implements UseCase<{ token: string }, { state: string }> {
  constructor(
    private readonly subscriptions: NewsletterRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { token: string }): Promise<{ state: string }> {
    if (input.token.trim() === '') throw new InvalidConfirmation()

    const found = await this.subscriptions.findByToken(input.token)
    if (found === null) throw new InvalidConfirmation()

    const next = found.confirm(input.token, this.clock.now())
    await this.subscriptions.save(next)

    return { state: next.state }
  }
}
