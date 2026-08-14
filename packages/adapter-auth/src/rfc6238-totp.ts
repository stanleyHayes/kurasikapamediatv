import { createHmac, randomBytes } from 'node:crypto'
import { CODE_DIGITS, TIME_STEP_SECONDS } from '@kurasikapa/domain'
import type { TotpPort } from '@kurasikapa/application'

/**
 * TOTP, RFC 6238, by hand.
 *
 * Twenty lines of HMAC and a truncation, against a dependency that would need
 * to be trusted with the second factor of every newsroom account. The
 * algorithm has not changed since 2011 and every authenticator app implements
 * exactly this; there is nothing here worth outsourcing.
 *
 * SHA-1 is correct and not a weakness. RFC 6238 specifies HMAC-SHA1, which
 * every scanner assumes, and HMAC-SHA1 is unaffected by the collision attacks
 * that retired plain SHA-1 — those need chosen-prefix collisions, which a MAC
 * construction does not expose. Choosing SHA-256 here would produce codes that
 * Google Authenticator cannot generate.
 */
const SECRET_BYTES = 20 // 160 bits — the RFC 4226 recommendation.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export class Rfc6238Totp implements TotpPort {
  generateSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES))
  }

  codeAt(secret: string, counter: number): string {
    const key = base32Decode(secret)

    // The counter is a 64-bit big-endian integer. Written via BigInt because a
    // 32-bit write silently truncates, and the failure would only appear in
    // the year 4147 — or immediately, for anyone testing with a large counter.
    const message = Buffer.alloc(8)
    message.writeBigUInt64BE(BigInt(counter))

    const digest = createHmac('sha1', key).update(message).digest()

    // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte picks
    // the offset, and the high bit is masked off so the result is positive on
    // platforms that read it as signed.
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f
    const binary =
      (((digest[offset] ?? 0) & 0x7f) << 24) |
      (((digest[offset + 1] ?? 0) & 0xff) << 16) |
      (((digest[offset + 2] ?? 0) & 0xff) << 8) |
      ((digest[offset + 3] ?? 0) & 0xff)

    return (binary % 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, '0')
  }

  /**
   * The `otpauth://` URI an authenticator scans.
   *
   * Digits and period are stated explicitly rather than left to defaults: an
   * app that assumed something else would generate codes this server rejects,
   * and the reader would have no way to tell why.
   */
  provisioningUri(input: {
    readonly secret: string
    readonly account: string
    readonly issuer: string
  }): string {
    const label = encodeURIComponent(`${input.issuer}:${input.account}`)
    const params = new URLSearchParams({
      secret: input.secret,
      issuer: input.issuer,
      algorithm: 'SHA1',
      digits: String(CODE_DIGITS),
      period: String(TIME_STEP_SECONDS),
    })

    return `otpauth://totp/${label}?${params.toString()}`
  }
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? ''
      bits -= 5
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? ''

  return output
}

export function base32Decode(encoded: string): Buffer {
  // Padding and lowercase are both common in the wild; neither carries meaning.
  const clean = encoded.toUpperCase().replace(/=+$/u, '').replace(/\s/gu, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Secret is not valid base32')

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}
