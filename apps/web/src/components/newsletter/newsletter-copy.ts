/**
 * Reader-facing sentences for newsletter outcomes.
 *
 * Codes are stable; the prose lives here so a form does not invent a
 * different sentence for the same failure on every screen.
 */
export function newsletterCopy(code: string, fallback: string): string {
  if (code === 'email_delivery_failed') {
    return 'We could not send the confirmation email. Mail is not configured yet.'
  }
  if (code === 'invalid_email') {
    return 'That does not look like an email address.'
  }
  if (code === 'empty_locales') {
    return 'Pick at least one language.'
  }
  if (code === 'invalid_confirmation') {
    return 'This confirmation link is not valid.'
  }

  return fallback
}
