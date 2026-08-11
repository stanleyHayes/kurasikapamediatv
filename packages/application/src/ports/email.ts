export interface EmailMessage {
  readonly to: string
  readonly subject: string
  readonly text: string
}

/**
 * Transactional mail. Newsletters and confirmations both go through here.
 *
 * `sendBatch` is for digests later; R2 double opt-in only needs `send`.
 */
export interface EmailPort {
  send(message: EmailMessage): Promise<void>
  sendBatch(messages: readonly EmailMessage[]): Promise<void>
}
