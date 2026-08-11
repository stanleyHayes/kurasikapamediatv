import { describe, expect, it } from 'vitest'
import { failClosedEmail } from './outbound'

describe('outbound adapters', () => {
  it('refuses mail when Resend is unset', async () => {
    await expect(
      failClosedEmail().send({ to: 'a@b.co', subject: 'x', text: 'y' }),
    ).rejects.toThrow(/RESEND_API_KEY/u)
  })
})
