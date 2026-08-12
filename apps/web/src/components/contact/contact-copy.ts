/**
 * Reader-facing sentences for contact-form outcomes.
 *
 * Codes are stable; the prose lives here so the form does not invent a
 * different sentence for the same failure on every screen.
 */
export function contactCopy(code: string, fallback: string): string {
  if (code === 'email_delivery_failed') {
    return 'We could not deliver your message. Mail is not configured yet.'
  }
  if (code === 'invalid_email') {
    return 'That does not look like an email address.'
  }
  if (code === 'empty_contact_message') {
    return 'Name and message are both required.'
  }
  if (code === 'contact_message_too_long') {
    return 'That message is too long. Please shorten it and try again.'
  }
  if (code === 'rate_limited') {
    return fallback
  }

  return fallback
}
