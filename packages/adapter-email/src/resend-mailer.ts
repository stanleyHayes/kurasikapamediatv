import type { EmailMessage, EmailPort } from '@kurasikapa/application'

export interface ResendConfig {
  readonly apiKey: string | undefined
  readonly from: string
  readonly post: typeof fetch
}

/**
 * Resend transactional mail.
 *
 * Fail-closed: an unset API key throws, so a confirmation is never reported
 * as sent when nothing left the building. Digests wait on the same door.
 */
export class ResendMailer implements EmailPort {
  constructor(private readonly config: ResendConfig) {}

  async send(message: EmailMessage): Promise<void> {
    if (this.config.apiKey === undefined || this.config.apiKey === '') {
      throw new Error('Email is not configured: RESEND_API_KEY is unset')
    }

    const response = await this.config.post('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    })

    if (!response.ok) {
      throw new Error(`Resend ${String(response.status)}`)
    }
  }

  async sendBatch(messages: readonly EmailMessage[]): Promise<void> {
    for (const message of messages) {
      await this.send(message)
    }
  }
}
