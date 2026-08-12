import { describe, expect, it } from 'vitest'
import { contactCopy } from './contact-copy'

describe('contactCopy', () => {
  it('explains a fail-closed mailer', () => {
    expect(contactCopy('email_delivery_failed', 'raw')).toMatch(/not configured/u)
  })

  it('keeps validation codes readable', () => {
    expect(contactCopy('invalid_email', 'x')).toMatch(/email/u)
    expect(contactCopy('empty_contact_message', 'x')).toMatch(/required/u)
    expect(contactCopy('contact_message_too_long', 'x')).toMatch(/too long/u)
  })

  it('passes rate-limit prose through', () => {
    expect(contactCopy('rate_limited', 'Try again in 40 seconds.')).toBe(
      'Try again in 40 seconds.',
    )
  })
})
