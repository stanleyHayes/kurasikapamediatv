import { describe, expect, it } from 'vitest'
import { InvalidToken } from '@kurasikapa/application'
import { claimsFor, userId } from '@kurasikapa/domain'
import { JoseTokenSigner } from './jose-token-signer'

const CONFIG = {
  secret: 's'.repeat(48),
  issuer: 'https://kurasikapa.tv',
  audience: 'urn:kurasikapa:web',
}

const signer = new JoseTokenSigner(CONFIG)
const NOW = new Date('2026-08-14T10:00:00.000Z')

const claims = claimsFor({
  userId: userId('u1'),
  sessionId: 'sess-1',
  kind: 'access',
  now: NOW,
})

describe('round trip', () => {
  it('returns exactly the claims it was given', async () => {
    const verified = await signer.verify(await signer.sign(claims))

    expect(verified).toStrictEqual(claims)
  })

  it('preserves the token kind, which is a security control', async () => {
    const challenge = claimsFor({
      userId: userId('u1'),
      sessionId: 'sess-1',
      kind: 'challenge',
      now: NOW,
    })

    expect((await signer.verify(await signer.sign(challenge))).kind).toBe('challenge')
  })

  it('stamps the domain-computed expiry, not a span from now', async () => {
    // `setExpirationTime` treats a STRING as a span and a NUMBER as absolute
    // seconds. Passing the wrong one silently ignores the domain's policy.
    expect((await signer.verify(await signer.sign(claims))).exp).toBe(claims.exp)
  })
})

describe('refusing tokens', () => {
  it('rejects a tampered payload', async () => {
    const token = await signer.sign(claims)
    const [header, , signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...claims, sub: 'someone-else' }),
      'utf8',
    ).toString('base64url')

    await expect(signer.verify(`${String(header)}.${forged}.${String(signature)}`)).rejects.toBeInstanceOf(
      InvalidToken,
    )
  })

  it('rejects a token signed with a different secret', async () => {
    const other = new JoseTokenSigner({ ...CONFIG, secret: 'x'.repeat(48) })

    await expect(signer.verify(await other.sign(claims))).rejects.toThrow(/signature/u)
  })

  it('rejects an unsigned "alg: none" token', async () => {
    // The classic JWT forgery. Pinning `algorithms` is what stops it, and this
    // asserts the pin is actually in place.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')

    await expect(signer.verify(`${header}.${payload}.`)).rejects.toBeInstanceOf(InvalidToken)
  })

  it('rejects a token minted for a different audience', async () => {
    const other = new JoseTokenSigner({ ...CONFIG, audience: 'urn:somebody-else' })

    await expect(signer.verify(await other.sign(claims))).rejects.toBeInstanceOf(InvalidToken)
  })

  it('rejects a token from a different issuer', async () => {
    const other = new JoseTokenSigner({ ...CONFIG, issuer: 'https://evil.example' })

    await expect(signer.verify(await other.sign(claims))).rejects.toBeInstanceOf(InvalidToken)
  })

  it.each([
    ['empty', ''],
    ['not a JWT', 'hello'],
    ['two segments', 'a.b'],
    ['garbage segments', 'a.b.c'],
  ])('rejects a %s token without leaking internals', async (_why, token) => {
    await expect(signer.verify(token)).rejects.toBeInstanceOf(InvalidToken)
  })
})

describe('expiry is the domain’s job, not jose’s', () => {
  it('still returns the claims of an expired token', async () => {
    // Deliberate. `assertUsable` checks expiry against an injected clock so the
    // rule is testable and lives in one place. If jose also rejected on `exp`,
    // there would be two expiry policies that must agree — and the domain's
    // would be the one nobody could see failing.
    const longExpired = claimsFor({
      userId: userId('u1'),
      sessionId: 'sess-1',
      kind: 'access',
      now: new Date('2020-01-01T00:00:00.000Z'),
    })

    await expect(signer.verify(await signer.sign(longExpired))).resolves.toMatchObject({
      sub: 'u1',
      kind: 'access',
    })
  })
})

describe('claims we will not vouch for', () => {
  it('rejects a validly signed token that is missing the session claims', async () => {
    // Signed by us, but not by this code path — e.g. a token minted before the
    // `kind` claim existed. Accepting it would default a challenge to access.
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('u1')
      .setIssuer(CONFIG.issuer)
      .setAudience(CONFIG.audience)
      .setIssuedAt(claims.iat)
      .setExpirationTime(claims.exp)
      .sign(new TextEncoder().encode(CONFIG.secret))

    await expect(signer.verify(token)).rejects.toThrow(/session claims/u)
  })
})
