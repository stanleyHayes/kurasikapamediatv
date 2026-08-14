import type { Credential, EmailAddress, ExternalProvider, SessionClaims, UserId } from '@kurasikapa/domain'
import { EmailAlreadyRegistered, type CredentialRepository } from '../ports/credential-repository'
import type { NewRefreshToken, RefreshTokenRepository } from '../ports/refresh-token-repository'
import type { RefreshTokenRecord } from '@kurasikapa/domain'
import type { PasswordHasher } from '../ports/password-hasher'
import { InvalidToken, type TokenSigner } from '../ports/token-signer'
import type { SecretGenerator, TotpPort } from '../ports/totp'
import type { RateLimitRule, RateLimitVerdict, RateLimiter } from '../ports/rate-limit'

/**
 * Hand-written fakes for the authentication ports.
 *
 * Real objects with real behaviour, not stubs that return whatever the last
 * test needed — AGENTS.md § 4. The in-memory credential store below enforces
 * the same email uniqueness the Mongo unique index does, because a fake that
 * is more permissive than production turns a concurrency bug into a passing
 * suite.
 */
export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly byUser = new Map<string, Credential>()

  findByEmail(email: EmailAddress): Promise<Credential | null> {
    for (const credential of this.byUser.values()) {
      if (credential.email.equals(email)) return Promise.resolve(credential)
    }

    return Promise.resolve(null)
  }

  findByUserId(userId: UserId): Promise<Credential | null> {
    return Promise.resolve(this.byUser.get(userId) ?? null)
  }

  findByExternal(provider: ExternalProvider, subject: string): Promise<Credential | null> {
    for (const credential of this.byUser.values()) {
      const external = credential.externalFor(provider)
      if (external?.subject === subject) return Promise.resolve(credential)
    }

    return Promise.resolve(null)
  }

  async create(credential: Credential): Promise<void> {
    if ((await this.findByEmail(credential.email)) !== null) {
      throw new EmailAlreadyRegistered(credential.email.value)
    }

    this.byUser.set(credential.userId, credential)
  }

  update(credential: Credential): Promise<void> {
    this.byUser.set(credential.userId, credential)

    return Promise.resolve()
  }

  get size(): number {
    return this.byUser.size
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly rows = new Map<string, RefreshTokenRecord>()

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) return Promise.resolve(row)
    }

    return Promise.resolve(null)
  }

  create(token: NewRefreshToken): Promise<void> {
    this.rows.set(token.id, { ...token, state: 'active' })

    return Promise.resolve()
  }

  rotate(spentId: string, replacement: NewRefreshToken): Promise<void> {
    const spent = this.rows.get(spentId)
    if (spent?.state !== 'active') {
      throw new Error(`Refresh token ${spentId} was not active`)
    }

    this.rows.set(spentId, { ...spent, state: 'rotated' })
    this.rows.set(replacement.id, { ...replacement, state: 'active' })

    return Promise.resolve()
  }

  revokeFamily(sessionId: string): Promise<void> {
    for (const [id, row] of this.rows) {
      if (row.sessionId === sessionId) this.rows.set(id, { ...row, state: 'revoked' })
    }

    return Promise.resolve()
  }

  revokeAllForUser(userId: UserId): Promise<void> {
    for (const [id, row] of this.rows) {
      if (row.userId === userId) this.rows.set(id, { ...row, state: 'revoked' })
    }

    return Promise.resolve()
  }

  /** Test seam: forces the state a scenario needs without a second use case. */
  setState(id: string, state: RefreshTokenRecord['state']): void {
    const row = this.rows.get(id)
    if (row !== undefined) this.rows.set(id, { ...row, state })
  }

  all(): RefreshTokenRecord[] {
    return [...this.rows.values()]
  }
}

/**
 * Hashing that is reversible and instant.
 *
 * A real KDF in a unit suite costs ~100ms per call by design, which would make
 * these tests slower than the adapter suite that already covers scrypt properly.
 */
export class FakePasswordHasher implements PasswordHasher {
  constructor(private readonly weakPrefix = 'weak:') {}

  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`)
  }

  verify(plain: string, encoded: string): Promise<boolean> {
    return Promise.resolve(encoded === `hashed:${plain}` || encoded === `${this.weakPrefix}${plain}`)
  }

  needsRehash(encoded: string): boolean {
    return encoded.startsWith(this.weakPrefix)
  }
}

/** Signs by serialising. Lets a test forge a token and watch it be refused. */
export class FakeTokenSigner implements TokenSigner {
  readonly signed: SessionClaims[] = []

  sign(claims: SessionClaims): Promise<string> {
    this.signed.push(claims)

    return Promise.resolve(`signed.${JSON.stringify(claims)}`)
  }

  verify(token: string): Promise<SessionClaims> {
    if (!token.startsWith('signed.')) throw new InvalidToken('not signed by us')

    try {
      return Promise.resolve(JSON.parse(token.slice('signed.'.length)) as SessionClaims)
    } catch {
      throw new InvalidToken('malformed')
    }
  }
}

/** Deterministic counters — a "code" is just the counter, zero padded. */
export class FakeTotp implements TotpPort {
  generateSecret(): string {
    return 'FAKESECRET'
  }

  codeAt(_secret: string, counter: number): string {
    return String(counter % 1_000_000).padStart(6, '0')
  }

  provisioningUri(): string {
    return 'otpauth://totp/fake'
  }
}

export class FakeSecretGenerator implements SecretGenerator {
  private counter = 0

  token(_bytes: number): string {
    this.counter += 1

    return `secret-${String(this.counter)}`
  }

  sha256(value: string): string {
    return `sha256(${value})`
  }

  equals(a: string, b: string): boolean {
    return a === b
  }
}

/** Allows everything until `deny()` is called. */
export class AllowingRateLimiter implements RateLimiter {
  private denied = false

  readonly consumed: string[] = []

  deny(): void {
    this.denied = true
  }

  consume(key: string, _rule: RateLimitRule): Promise<RateLimitVerdict> {
    this.consumed.push(key)

    return Promise.resolve(this.denied
      ? { allowed: false, remaining: 0, retryAfterSeconds: 42 }
      : { allowed: true, remaining: 1, retryAfterSeconds: 0 })
  }
}
