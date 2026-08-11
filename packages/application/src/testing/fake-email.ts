import type { EmailMessage, EmailPort } from '../ports/email'

export class RecordingEmail implements EmailPort {
  readonly sent: EmailMessage[] = []

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message)
    return Promise.resolve()
  }

  sendBatch(messages: readonly EmailMessage[]): Promise<void> {
    this.sent.push(...messages)
    return Promise.resolve()
  }
}

export class FailClosedEmail implements EmailPort {
  send(): Promise<void> {
    return Promise.reject(new Error('Email is not configured: RESEND_API_KEY is unset'))
  }

  sendBatch(): Promise<void> {
    return this.send()
  }
}
