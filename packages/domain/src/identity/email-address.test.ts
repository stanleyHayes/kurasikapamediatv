import { describe, expect, it } from 'vitest'
import { EmailAddress, InvalidEmailAddress } from './email-address'

describe('EmailAddress', () => {
  it('normalises case and surrounding whitespace', () => {
    // The same inbox typed three ways must be one account, not three.
    expect(EmailAddress.of('  Editor@Kurasikapa.TV ').value).toBe('editor@kurasikapa.tv')
  })

  it('treats two spellings of one address as equal', () => {
    expect(EmailAddress.of('A@B.com').equals(EmailAddress.of('a@b.com'))).toBe(true)
  })

  it('does NOT strip dots or plus-tags', () => {
    // Whether these are one inbox is a Gmail policy, not an email one.
    // Applying it everywhere would merge accounts that were never the same
    // person — the failure mode is silent and unrecoverable.
    expect(EmailAddress.of('a.b@example.com').value).toBe('a.b@example.com')
    expect(EmailAddress.of('editor+news@example.com').value).toBe('editor+news@example.com')
  })

  it('splits into local part and domain on the LAST @', () => {
    // Quoted local parts may contain an @. Splitting on the first one would
    // hand the wrong string to a domain allowlist.
    const address = EmailAddress.of('"odd@name"@example.com')

    expect(address.domain).toBe('example.com')
    expect(address.localPart).toBe('"odd@name"')
  })

  describe('refuses what cannot be an address', () => {
    it.each([
      ['empty', ''],
      ['only whitespace', '   '],
      ['no @', 'editor.example.com'],
      ['nothing before @', '@example.com'],
      ['nothing after @', 'editor@'],
      ['internal whitespace', 'edi tor@example.com'],
      ['domain with no dot', 'editor@localhost'],
      ['domain starting with a dot', 'editor@.example.com'],
      ['domain ending with a dot', 'editor@example.'],
    ])('%s', (_why, value) => {
      expect(() => EmailAddress.of(value)).toThrow(InvalidEmailAddress)
    })

    it('longer than RFC 5321 allows', () => {
      // 254 is the ceiling for a path; anything longer cannot be delivered, so
      // storing it would create an account nobody can ever confirm.
      const tooLong = `${'a'.repeat(250)}@example.com`

      expect(() => EmailAddress.of(tooLong)).toThrow(InvalidEmailAddress)
    })
  })

  it('accepts the shapes real newsroom addresses take', () => {
    // Loose on purpose: the only proof an address exists is that mail to it
    // arrives, so this rejects the impossible and lets confirmation do the rest.
    for (const value of [
      'editor@kurasikapa.tv',
      'first.last@sub.domain.co.uk',
      'news+tips@kurasikapa.tv',
      "o'brien@example.com",
    ]) {
      expect(EmailAddress.of(value).value).toBe(value)
    }
  })

  it('names the value it rejected, for a form that has to explain itself', () => {
    expect(() => EmailAddress.of('nope')).toThrow(/"nope"/u)
  })
})
