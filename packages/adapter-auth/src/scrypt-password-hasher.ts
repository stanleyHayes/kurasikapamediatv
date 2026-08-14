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
    if (parsed === null) return false

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
