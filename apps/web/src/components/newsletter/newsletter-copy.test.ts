import { describe, expect, it } from 'vitest'
import { newsletterCopy } from './newsletter-copy'

describe('newsletterCopy', () => {
  it('explains a missing mailer without leaking configuration', () => {
    expect(newsletterCopy('email_delivery_failed', 'raw')).toMatch(/not configured/u)
  })

  it('keeps an unknown code as the fallback the server already wrote', () => {
    expect(newsletterCopy('rate_limited', 'Try again in 40 seconds.')).toBe(
      'Try again in 40 seconds.',
    )
  })

  it('maps the domain refusals a reader can cause from the form', () => {
    expect(newsletterCopy('invalid_email', 'x')).toMatch(/email/u)
    expect(newsletterCopy('empty_locales', 'x')).toMatch(/language/u)
    expect(newsletterCopy('invalid_confirmation', 'x')).toMatch(/not valid/u)
  })
})
