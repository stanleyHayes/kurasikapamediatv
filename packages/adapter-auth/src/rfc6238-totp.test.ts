import { describe, expect, it } from 'vitest'
import { TIME_STEP_SECONDS } from '@kurasikapa/domain'
import { Rfc6238Totp, base32Decode, base32Encode } from './rfc6238-totp'

const totp = new Rfc6238Totp()

/**
 * RFC 6238 Appendix B, the SHA-1 rows.
 *
 * The published seed is the ASCII string "12345678901234567890"; this is its
 * base32 encoding, which is the form an authenticator actually receives.
 */
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'))

/**
 * The RFC prints eight-digit codes. We issue six, and six is the last six of
 * eight — both are `binary % 10^n` of the same truncation — so the expected
 * values below are the published ones with the leading two digits dropped.
 */
const VECTORS: readonly { unixTime: number; eightDigit: string }[] = [
  { unixTime: 59, eightDigit: '94287082' },
  { unixTime: 1_111_111_109, eightDigit: '07081804' },
  { unixTime: 1_111_111_111, eightDigit: '14050471' },
  { unixTime: 1_234_567_890, eightDigit: '89005924' },
  { unixTime: 2_000_000_000, eightDigit: '69279037' },
  { unixTime: 20_000_000_000, eightDigit: '65353130' },
]

describe('RFC 6238 conformance', () => {
  it.each(VECTORS)(
    'matches the published code at T=$unixTime',
    ({ unixTime, eightDigit }) => {
      // If this ever fails, every authenticator app in the newsroom stops
      // agreeing with the server — which is the one bug in this file that
      // cannot be discovered by reading it.
      const counter = Math.floor(unixTime / TIME_STEP_SECONDS)

      expect(totp.codeAt(RFC_SECRET, counter)).toBe(eightDigit.slice(-6))
    },
  )

  it('handles counters beyond 32 bits', () => {
    // T=20000000000 is counter 666,666,666 — comfortably inside 32 bits, but
    // the 64-bit write is what keeps this correct as the epoch grows. A
    // 32-bit write would pass the rows above and fail silently later.
    expect(() => totp.codeAt(RFC_SECRET, 2 ** 40)).not.toThrow()
    expect(totp.codeAt(RFC_SECRET, 2 ** 40)).toHaveLength(6)
  })
})

describe('codes', () => {
  it('is always six digits, zero padded', () => {
    // A code that formats as "12345" is rejected by an input expecting six,
    // and truncation bugs surface exactly as a missing leading zero.
    for (let counter = 0; counter < 300; counter += 1) {
      expect(totp.codeAt(RFC_SECRET, counter)).toMatch(/^\d{6}$/u)
    }
  })

  it('changes from one step to the next', () => {
    expect(totp.codeAt(RFC_SECRET, 100)).not.toBe(totp.codeAt(RFC_SECRET, 101))
  })

  it('differs between secrets at the same counter', () => {
    const other = totp.generateSecret()

    expect(totp.codeAt(RFC_SECRET, 100)).not.toBe(totp.codeAt(other, 100))
  })
})

describe('generateSecret', () => {
  it('produces a decodable 160-bit secret', () => {
    // RFC 4226 recommends 160 bits. A shorter secret weakens every code
    // derived from it, silently.
    expect(base32Decode(totp.generateSecret())).toHaveLength(20)
  })

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 50 }, () => totp.generateSecret()))

    expect(seen.size).toBe(50)
  })
})

describe('provisioningUri', () => {
  const uri = totp.provisioningUri({
    secret: RFC_SECRET,
    account: 'editor@kurasikapa.tv',
    issuer: 'Kurasikapa Media',
  })

  it('is an otpauth totp URI', () => {
    expect(uri.startsWith('otpauth://totp/')).toBe(true)
  })

  it('states digits and period rather than trusting defaults', () => {
    // An app that assumed 8 digits or a 60-second period would generate codes
    // this server rejects, and the reader would have no way to know why.
    expect(uri).toContain('digits=6')
    expect(uri).toContain(`period=${String(TIME_STEP_SECONDS)}`)
    expect(uri).toContain('algorithm=SHA1')
  })

  it('escapes the label, which contains an @ and a colon', () => {
    expect(uri).toContain(encodeURIComponent('Kurasikapa Media:editor@kurasikapa.tv'))
  })
})

describe('base32', () => {
  it.each([
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI'],
  ])('encodes %o (RFC 4648, unpadded)', (input, expected) => {
    expect(base32Encode(Buffer.from(input, 'ascii'))).toBe(expected)
  })

  it('round trips arbitrary bytes', () => {
    const bytes = Buffer.from([0, 1, 127, 128, 255, 42, 17])

    expect(base32Decode(base32Encode(bytes))).toStrictEqual(bytes)
  })

  it('tolerates the padding and lowercase real secrets arrive with', () => {
    // Authenticator exports and QR readers produce both; neither carries meaning.
    expect(base32Decode('mzxw6ytboi======')).toStrictEqual(Buffer.from('foobar', 'ascii'))
  })

  it('refuses a secret that is not base32 rather than hashing rubbish', () => {
    expect(() => base32Decode('not-base32!')).toThrow(/base32/u)
  })
})
