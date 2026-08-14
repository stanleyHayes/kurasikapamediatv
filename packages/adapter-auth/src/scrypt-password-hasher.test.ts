import { describe, expect, it } from 'vitest'
import { ScryptPasswordHasher } from './scrypt-password-hasher'

const hasher = new ScryptPasswordHasher()
const PASSWORD = 'correct horse battery staple'

describe('hash', () => {
  it('round trips', async () => {
    expect(await hasher.verify(PASSWORD, await hasher.hash(PASSWORD))).toBe(true)
  })

  it('refuses the wrong password', async () => {
    expect(await hasher.verify('wrong horse battery staple', await hasher.hash(PASSWORD))).toBe(
      false,
    )
  })

  it('salts, so the same password hashes differently every time', async () => {
    // Without a per-password salt, identical passwords are visibly identical
    // in the database and one cracked hash cracks every account that shares it.
    expect(await hasher.hash(PASSWORD)).not.toBe(await hasher.hash(PASSWORD))
  })

  it('carries its parameters, so a future cost change stays verifiable', async () => {
    const [scheme, n, r, p] = (await hasher.hash(PASSWORD)).split('$')

    expect(scheme).toBe('scrypt')
    expect(Number(n)).toBeGreaterThanOrEqual(65_536)
    expect(Number(r)).toBe(8)
    expect(Number(p)).toBeGreaterThanOrEqual(1)
  })

  it('normalises unicode, so a passphrase survives a different keyboard', async () => {
    // "é" has two encodings. Without NFC, signing in from a Mac with a
    // password typed on Windows fails for reasons nobody can see.
    const composed = 'café passphrase ok'
    const decomposed = 'café passphrase ok'

    expect(await hasher.verify(decomposed, await hasher.hash(composed))).toBe(true)
  })
})

describe('verify, against hostile input', () => {
  it.each([
    ['empty', ''],
    ['not our scheme', 'argon2id$v=19$m=65536$abc$def'],
    ['too few fields', 'scrypt$65536$8$salt$hash'],
    ['non-numeric parameters', 'scrypt$N$r$p$c2FsdA$aGFzaA'],
    ['plausible but truncated', 'scrypt$65536$8$2$c2FsdA'],
    ['bare noise', 'not-a-hash-at-all'],
  ])('answers false for a %s stored hash, rather than throwing', async (_why, stored) => {
    // A corrupt or foreign row is a failed sign-in. A 500 here would tell
    // whoever probed it that they found something unusual.
    await expect(hasher.verify(PASSWORD, stored)).resolves.toBe(false)
  })
})

describe('needsRehash', () => {
  it('is false for a hash made with current parameters', async () => {
    expect(hasher.needsRehash(await hasher.hash(PASSWORD))).toBe(false)
  })

  it('is true for a weaker cost', () => {
    // The only moment a rehash is possible is while the plaintext is in hand
    // during sign-in. Without this, raising the cost protects nobody who
    // already has an account.
    expect(hasher.needsRehash('scrypt$16384$8$1$c2FsdA$aGFzaA')).toBe(true)
  })

  it('is true for a foreign format, so Better Auth rows migrate on sign-in', () => {
    // This is how the incumbent's password hashes get upgraded without a
    // reset email to every reader.
    expect(hasher.needsRehash('$2b$10$abcdefghijklmnopqrstuv')).toBe(true)
    expect(hasher.needsRehash('')).toBe(true)
  })
})
