import { normaliseEmail } from '@kurasikapa/domain'
import { EmailDeliveryFailed } from '../audience/subscribe-newsletter'
import type { EmailPort } from '../ports/email'
import type { UseCase } from '../ports/use-case'

export interface SubmitContactMessageDeps {
  readonly email: EmailPort
  readonly newsroomTo: string
}

export interface SubmitContactMessageInput {
  readonly name: string
  readonly email: string
  readonly message: string
}

const MAX_NAME = 120
const MAX_MESSAGE = 4000

export class EmptyContactMessage extends Error {
  constructor() {
    super('Contact message is empty')
    this.name = 'EmptyContactMessage'
  }
}

export class ContactMessageTooLong extends Error {
  constructor() {
    super('Contact message is too long')
    this.name = 'ContactMessageTooLong'
  }
}

/**
 * Forwards a reader note to the newsroom.
 *
 * Fail-closed when mail cannot leave: a “sent” screen with no delivery is
 * worse than an honest error. Nothing is persisted — contact is not a CRM.
 */
export class SubmitContactMessage
  implements UseCase<SubmitContactMessageInput, { sent: true }>
{
  constructor(private readonly deps: SubmitContactMessageDeps) {}

  async execute(input: SubmitContactMessageInput): Promise<{ sent: true }> {
    const name = input.name.trim()
    const message = input.message.trim()
    if (name === '' || message === '') throw new EmptyContactMessage()
    if (name.length > MAX_NAME || message.length > MAX_MESSAGE) {
      throw new ContactMessageTooLong()
    }

    const from = normaliseEmail(input.email)

    try {
      await this.deps.email.send({
        to: this.deps.newsroomTo,
        subject: `Contact: ${name}`,
        text: `From: ${name} <${from}>\n\n${message}\n`,
      })
    } catch {
      throw new EmailDeliveryFailed()
    }

    return { sent: true }
  }
}
