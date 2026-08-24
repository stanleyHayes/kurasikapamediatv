import { describe, expect, it } from 'vitest'
import { ScryptPasswordHasher } from './scrypt-password-hasher'

const hasher = new ScryptPasswordHasher()
const PASSWORD = 'correct horse battery staple'

/**
 * Every test below that hashes needs longer than Vitest's 5s default.
 *
 * ~220ms per call on an idle machine is the parameters working as intended —
 * scrypt is memory-hard on purpose. But `pnpm verify` runs every package's
 * suite at once through turbo, each with its own worker pool, and a KDF that
 * is deliberately CPU- and memory-bound stretches by an order of magnitude on
 * a saturated box. A single hash-and-verify then runs past 5s and the suite
 * goes red on a machine that is merely busy — which is exactly what CI is.
 *
 * Raised on these suites rather than in vitest.config.ts, so the rest of the
 * package keeps the default where a slow test really does mean a hang. The
 * alternative fix — lowering N, r or p until the default fits — would trade a
 * security property for a green run, and the parameters are load-bearing.
 */
const KDF_TIMEOUT_MS = 60_000

describe('hash', { timeout: KDF_TIMEOUT_MS }, () => {
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

describe('needsRehash', { timeout: KDF_TIMEOUT_MS }, () => {
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

/**
 * The one foreign format this hasher must READ.
 *
 * Better Auth owned sign-in before KUR-66 and stored `salt:key` hex from
 * scrypt N=16384 r=16 p=1 dkLen=64, over an NFKC-normalised password. Every
 * account that exists today has one of these. Without this the cutover locks
 * out every user, because `findByEmail` returns a credential whose hash this
 * hasher cannot check — and `needsRehash` above only upgrades a password it
 * has first VERIFIED.
 */
describe('verify, against a Better Auth hash', { timeout: KDF_TIMEOUT_MS }, () => {
  const legacy = async (password: string): Promise<string> => {
    const { randomBytes, scrypt } = await import('node:crypto')
    const salt = randomBytes(16).toString('hex')
    const key = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password.normalize('NFKC'),
        salt,
        64,
        { N: 16_384, r: 16, p: 1, maxmem: 128 * 16_384 * 16 * 2 },
        (error, derived) => {
          if (error) reject(error)
          else resolve(derived)
        },
      )
    })

    return `${salt}:${key.toString('hex')}`
  }

  it('accepts the right password', async () => {
    expect(await hasher.verify(PASSWORD, await legacy(PASSWORD))).toBe(true)
  })

  it('refuses the wrong one', async () => {
    expect(await hasher.verify('not it', await legacy(PASSWORD))).toBe(false)
  })

  it('normalises the same way, so a passphrase survives the migration', async () => {
    // Better Auth normalised NFKC before hashing. Verifying without it would
    // reject a correct password composed differently by another keyboard —
    // the user would be told their password is wrong and it would never work.
    const composed = 'café passphrase'.normalize('NFC')
    const decomposed = 'café passphrase'.normalize('NFD')
    expect(await hasher.verify(decomposed, await legacy(composed))).toBe(true)
  })

  it('marks it for rehash, so the row is upgraded on that sign-in', async () => {
    expect(hasher.needsRehash(await legacy(PASSWORD))).toBe(true)
  })

  it('is not fooled by a colon in something that is not a legacy hash', async () => {
    expect(await hasher.verify(PASSWORD, 'nonsense:alsononsense')).toBe(false)
    expect(await hasher.verify(PASSWORD, ':')).toBe(false)
    expect(await hasher.verify(PASSWORD, 'zz:zz')).toBe(false)
  })
})
