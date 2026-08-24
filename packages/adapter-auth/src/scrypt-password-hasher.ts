import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'
import type { PasswordHasher } from '@kurasikapa/application'

/**
 * Annotated, because `promisify` resolves `scrypt`'s THREE-argument overload
 * and silently drops the options object — which is where every cost parameter
 * lives. Left inferred, this compiles to a call that ignores N, r and p and
 * hashes at Node's defaults.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

/**
 * Password hashing with scrypt from `node:crypto`.
 *
 * **Why not argon2id.** It is the better algorithm and it is what this would
 * use given a free choice. Every usable Node binding is a native module with a
 * postinstall build, and this repository's pnpm policy denies install scripts
 * by default (`pnpm-workspace.yaml`) — a policy that has already caught two
 * real supply-chain signals here. Trading that for a marginally better KDF is
 * the wrong trade. scrypt is memory-hard, is in the standard library, and is
 * on OWASP's recommended list.
 *
 * **Parameters.** N=2^16, r=8, p=2 is one of OWASP's listed equivalent-strength
 * scrypt configurations. The first-choice config (N=2^17, r=8, p=1) needs
 * ~134 MB per hash; on a serverless instance sized in hundreds of megabytes,
 * a handful of concurrent sign-ins would exhaust it. This one needs ~67 MB and
 * pays for the difference in CPU instead, which is the resource that degrades
 * gracefully rather than the one that kills the process.
 *
 * **Encoding.** `scrypt$N$r$p$salt$hash`, all base64url. The parameters travel
 * WITH the hash, so raising them later leaves existing passwords verifiable and
 * `needsRehash` can spot the old ones.
 */
const PARAMS = { N: 65_536, r: 8, p: 2 } as const

const KEY_LENGTH = 32
const SALT_BYTES = 16

/**
 * Node caps scrypt memory at 32 MB unless told otherwise, and 128·N·r here is
 * ~67 MB — without this every hash throws instead of running.
 */
const MAX_MEMORY = 128 * PARAMS.N * PARAMS.r * 2

const b64 = (buffer: Buffer): string => buffer.toString('base64url')

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES)
    const derived = await this.derive(plain, salt, PARAMS)

    return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, b64(salt), b64(derived)].join('$')
  }

  /**
   * Answers false for anything it cannot parse rather than throwing.
   *
   * A corrupt or foreign row is a failed sign-in. Throwing would turn it into
   * a 500, which tells whoever probed it that they found something unusual.
   */
  async verify(plain: string, encoded: string): Promise<boolean> {
    const parsed = parse(encoded)

    // Not our format. Before giving up, try the one format we inherited —
    // every account that predates KUR-66 has a Better Auth hash, and refusing
    // it here would lock out every existing reader and editor on the day the
    // custom stack takes over sign-in. `needsRehash` returns true for it, so
    // the row is upgraded during this same sign-in.
    if (parsed === null) return verifyLegacy(plain, encoded)

    try {
      const derived = await this.derive(plain, parsed.salt, parsed.params)

      // Lengths must match before timingSafeEqual, which throws otherwise —
      // and that throw is itself a length oracle.
      if (derived.length !== parsed.hash.length) return false

      return timingSafeEqual(derived, parsed.hash)
    } catch {
      return false
    }
  }

  /**
   * True when the stored hash used weaker parameters than today's.
   *
   * Also true for an unparseable hash, so a legacy or foreign format is
   * upgraded the next time its owner signs in successfully — which is how the
   * Better Auth rows get migrated without a password reset email.
   */
  needsRehash(encoded: string): boolean {
    const parsed = parse(encoded)
    if (parsed === null) return true

    return (
      parsed.params.N < PARAMS.N || parsed.params.r < PARAMS.r || parsed.params.p < PARAMS.p
    )
  }

  private async derive(
    plain: string,
    salt: Buffer,
    params: { N: number; r: number; p: number },
  ): Promise<Buffer> {
    return scryptAsync(plain.normalize('NFC'), salt, KEY_LENGTH, {
      ...params,
      maxmem: MAX_MEMORY,
    })
  }
}

interface Parsed {
  readonly params: { N: number; r: number; p: number }
  readonly salt: Buffer
  readonly hash: Buffer
}

function parse(encoded: string): Parsed | null {
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null

  const [, rawN, rawR, rawP, salt, hash] = parts
  const N = Number(rawN)
  const r = Number(rawR)
  const p = Number(rawP)

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null
  if (salt === undefined || hash === undefined) return null

  return {
    params: { N, r, p },
    salt: Buffer.from(salt, 'base64url'),
    hash: Buffer.from(hash, 'base64url'),
  }
}

/**
 * Better Auth's scrypt, reproduced exactly enough to check a stored hash.
 *
 * `salt:key`, both hex, from scrypt N=16384 r=16 p=1 dkLen=64 over an
 * NFKC-normalised password — and the salt is fed to scrypt as the hex STRING,
 * not as the 16 bytes it encodes. Getting any one of those wrong verifies
 * nothing and reads as "wrong password" to someone whose password is right.
 *
 * Read from `@better-auth/utils/password` at 0.4.3 rather than remembered.
 * There is no `hashLegacy`: nothing should ever WRITE this format again.
 */
const LEGACY_PARAMS = { N: 16_384, r: 16, p: 1 } as const
const LEGACY_KEY_LENGTH = 64
const LEGACY_MAX_MEMORY = 128 * LEGACY_PARAMS.N * LEGACY_PARAMS.r * 2
const HEX = /^[0-9a-f]+$/u

async function verifyLegacy(plain: string, encoded: string): Promise<boolean> {
  const parts = encoded.split(':')
  if (parts.length !== 2) return false

  const [salt, key] = parts
  if (salt === undefined || key === undefined) return false
  if (!HEX.test(salt) || !HEX.test(key)) return false

  // Length checked before deriving: a 64-byte key is 128 hex characters, and
  // anything else is a different format that merely contains a colon. Skipping
  // this spends ~200ms of scrypt on every malformed row.
  if (key.length !== LEGACY_KEY_LENGTH * 2) return false

  try {
    const derived = await scryptAsync(
      plain.normalize('NFKC'),
      // The hex string itself, as UTF-8 — this is what Better Auth passed.
      Buffer.from(salt, 'utf8'),
      LEGACY_KEY_LENGTH,
      { ...LEGACY_PARAMS, maxmem: LEGACY_MAX_MEMORY },
    )
    const stored = Buffer.from(key, 'hex')

    if (derived.length !== stored.length) return false

    return timingSafeEqual(derived, stored)
  } catch {
    return false
  }
}
