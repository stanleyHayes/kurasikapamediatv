import {
  SignJWT,
  decodeJwt,
  decodeProtectedHeader,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  type CryptoKey,
  type JSONWebKeySet,
  type JWTPayload,
} from 'jose'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OAuthExchangeFailed, type ExternalUser } from '@kurasikapa/application'
import { FakeClock, FakeSecretGenerator } from '@kurasikapa/application/testing'
import { AppleOAuthProvider, type AppleOAuthConfig } from './apple'

/**
 * Sign in with Apple, exercised end to end without a network.
 *
 * The id_tokens below are signed by a REAL RSA key generated in this file and
 * verified against a REAL JWKS served by the fake transport. Handing the
 * adapter a pre-parsed payload instead would stub past `jwtVerify` — the one
 * call standing between a forged token and a session — and every forgery case
 * here would pass against an adapter that verified nothing at all.
 */
const APPLE = 'https://appleid.apple.com'
const JWKS_URL = `${APPLE}/auth/keys`
const SERVICES_ID = 'tv.kurasikapa.web'
const TEAM_ID = 'ABCDE12345'
const KEY_ID = 'KEY1234567'
const APPLE_KID = 'apple-signing-key-1'
const REDIRECT = 'https://kurasikapa.tv/api/auth/callback/apple'
const SUBJECT = '001234.5678abcd9999.1200'
const EMAIL = 'reader@privaterelay.appleid.com'
const NONCE = 'nonce-from-this-browser'
const NOW = new Date('2026-08-14T10:00:00.000Z')
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
const DAY_MS = 24 * 60 * 60 * 1000
/** Apple's own ceiling on a client secret's `exp`. Six months, in seconds. */
const APPLE_MAX_SECRET_LIFETIME = 15_777_000

const appleKeys = await generateKeyPair('RS256', { extractable: true })
// A well-formed token from a key we never trusted: the case a JWKS lookup that
// merely finds "some" key would wave through.
const foreignKeys = await generateKeyPair('RS256', { extractable: true })
const p8Keys = await generateKeyPair('ES256', { extractable: true })
const PRIVATE_KEY_PKCS8 = await exportPKCS8(p8Keys.privateKey)

const JWKS: JSONWebKeySet = {
  keys: [{ ...(await exportJWK(appleKeys.publicKey)), kid: APPLE_KID, alg: 'RS256', use: 'sig' }],
}

const CONFIG: AppleOAuthConfig = {
  servicesId: SERVICES_ID, teamId: TEAM_ID, keyId: KEY_ID, privateKeyPkcs8: PRIVATE_KEY_PKCS8,
}

const EXCHANGE = { code: 'apple-authorization-code', redirectUri: REDIRECT, nonce: NONCE, codeVerifier: null }

const CLAIMS: JWTPayload = {
  iss: APPLE, aud: SERVICES_ID, sub: SUBJECT, nonce: NONCE, email: EMAIL, email_verified: true,
}

/**
 * A signed id_token, valid right now.
 *
 * `iat`/`exp` come from jose rather than the injected clock on purpose:
 * `jwtVerify` reads the real clock for expiry, so a token stamped with a fixed
 * 2026 timestamp would verify today and start failing the day the machine's
 * clock passed it. Nothing in this file reads the clock itself.
 */
function idToken(overrides: JWTPayload = {}, key: CryptoKey = appleKeys.privateKey): Promise<string> {
  return new SignJWT({ ...CLAIMS, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: APPLE_KID })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
}

/** `alg: none`, hand-built because no signer will produce one. */
function unsignedIdToken(): string {
  const seg = (v: unknown): string => Buffer.from(JSON.stringify(v), 'utf8').toString('base64url')

  return `${seg({ alg: 'none', typ: 'JWT' })}.${seg(CLAIMS)}.`
}

/** A symmetric forgery: the attack the pinned `algorithms` list exists to stop. */
function hs256IdToken(): Promise<string> {
  return new SignJWT(CLAIMS)
    .setProtectedHeader({ alg: 'HS256', kid: APPLE_KID })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode('a'.repeat(32)))
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Apple's two endpoints, hand-written — `vi.mock` is banned (AGENTS.md § 4).
 *
 * One object answers both, because the same instance is injected as the
 * adapter's `FetchLike` AND installed as the global `fetch`: jose's
 * `createRemoteJWKSet` is built inside the constructor and reaches for the
 * global, so the key set is the one seam that cannot be passed in.
 */
class FakeApple {
  /** Every token POST body. The client-secret assertions read them back. */
  readonly tokenPosts: URLSearchParams[] = []

  constructor(private readonly reply: () => Promise<Response>) {}

  readonly fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if ((url instanceof URL ? url.href : url) === JWKS_URL) return Promise.resolve(json(200, JWKS))

    const body = init?.body

    this.tokenPosts.push(body instanceof URLSearchParams ? body : new URLSearchParams())

    return this.reply()
  }

  field(name: string, at = 0): string {
    return this.tokenPosts[at]?.get(name) ?? ''
  }
}

/** Records the entropy asked for, so "32 bytes of state" is an assertion. */
class RecordingSecrets extends FakeSecretGenerator {
  readonly entropyRequested: number[] = []

  override token(bytes: number): string {
    this.entropyRequested.push(bytes)

    return super.token(bytes)
  }
}

interface Rig {
  readonly provider: AppleOAuthProvider
  readonly apple: FakeApple
  readonly secrets: RecordingSecrets
}

function rig(reply: () => Promise<Response>, clock = new FakeClock(NOW), cfg: Partial<AppleOAuthConfig> = {}): Rig {
  const apple = new FakeApple(reply)
  const secrets = new RecordingSecrets()

  globalThis.fetch = apple.fetch

  return { provider: new AppleOAuthProvider({ ...CONFIG, ...cfg }, secrets, clock, apple.fetch), apple, secrets }
}

/** A token endpoint that succeeds. A factory, because a Response body is single-use. */
function replyWith(token: string): () => Promise<Response> {
  return () => Promise.resolve(json(200, { access_token: 'a', token_type: 'Bearer', id_token: token }))
}

function exchangeOf(token: string): Promise<ExternalUser> {
  return rig(replyWith(token)).provider.exchange(EXCHANGE)
}

const REAL_FETCH = globalThis.fetch

beforeEach(() => {
  // Fails loudly rather than reaching the internet if a path is ever left unrouted.
  globalThis.fetch = () => Promise.reject(new Error('a test tried to reach the network'))
})

afterEach(() => {
  globalThis.fetch = REAL_FETCH
})

describe('the authorization request', () => {
  it('carries every parameter Apple requires, and nothing else', async () => {
    const { provider } = rig(replyWith(''))

    const { url } = await provider.authorization({ redirectUri: REDIRECT })

    expect(Object.fromEntries(new URL(url).searchParams)).toStrictEqual({
      client_id: SERVICES_ID,
      redirect_uri: REDIRECT,
      response_type: 'code',
      // Requesting a scope is what makes `response_mode=form_post` mandatory;
      // the pair has to move together or the callback arrives empty.
      scope: 'name email',
      response_mode: 'form_post',
      state: 'secret-1',
      nonce: 'secret-2',
    })
    expect(url.startsWith(`${APPLE}/auth/authorize?`)).toBe(true)
    // `URLSearchParams` serialises a space as `+`; Apple documents `%20`.
    expect(url).toContain('scope=name%20email')
    expect(url).not.toContain('+')
  })

  it('draws state and nonce from the injected generator, 32 bytes each', async () => {
    const { provider, secrets } = rig(replyWith(''))

    const request = await provider.authorization({ redirectUri: REDIRECT })

    // The values the caller must store, and the entropy behind them. A `state`
    // that is not unguessable is not a CSRF token at all.
    expect([request.state, request.nonce]).toStrictEqual(['secret-1', 'secret-2'])
    expect(secrets.entropyRequested).toStrictEqual([32, 32])
  })

  it('sends no PKCE challenge and hands back no verifier', async () => {
    const { provider } = rig(replyWith(''))

    const request = await provider.authorization({ redirectUri: REDIRECT })

    // Apple advertises no `code_challenge_methods_supported` and authenticates
    // the client with the minted secret instead. A challenge sent anyway is
    // ignored, so shipping one would read as protection while providing none —
    // and a non-null verifier here would make `exchange` look PKCE-guarded to
    // every caller. Google is where the S256 challenge is asserted.
    expect(request.codeVerifier).toBeNull()
    expect(new URL(request.url).searchParams.has('code_challenge')).toBe(false)
  })
})

describe('a successful exchange', () => {
  it('returns the verified identity from the id_token', async () => {
    const user = await exchangeOf(await idToken())

    expect(user).toStrictEqual({
      provider: 'apple',
      subject: SUBJECT,
      email: EMAIL,
      emailVerified: true,
      // Apple sends the name once, in the form_post body, never in the token.
      displayName: null,
    })
  })

  it.each([
    ['a boolean true', true, true],
    // Apple documents a boolean and ships the string on some paths. Reading
    // only `=== true` marks these verified addresses unverified and blocks
    // legitimate account matching.
    ['the string "true"', 'true', true],
    ['a boolean false', false, false],
    ['absent', undefined, false],
    // Truthy-testing would promote this one, which is account takeover in a step.
    ['the string "false"', 'false', false],
  ])('treats email_verified %s as %s', async (_case, claim, expected) => {
    const user = await exchangeOf(await idToken({ email_verified: claim }))

    expect(user.emailVerified).toBe(expected)
  })

  it('reports no email as unverified rather than verifying a null address', async () => {
    const user = await exchangeOf(await idToken({ email: undefined, email_verified: true }))

    expect(user.email).toBeNull()
    expect(user.emailVerified).toBe(false)
  })
})

describe('id_tokens that must be refused', () => {
  it.each([
    ['signed by a key that is not Apple’s', () => idToken({}, foreignKeys.privateKey), /did not verify/u],
    ['minted for another Apple client', () => idToken({ aud: 'com.someone.else' }), /did not verify/u],
    ['issued by someone who is not Apple', () => idToken({ iss: 'https://evil.example' }), /did not verify/u],
    ['forged to alg "none"', () => Promise.resolve(unsignedIdToken()), /did not verify/u],
    ['forged to HS256', hs256IdToken, /did not verify/u],
    // Absent, not merely different: `requiredClaims` is what stops a nonce-less
    // token slipping past a comparison that only runs when a nonce is present.
    ['carrying no nonce at all', () => idToken({ nonce: undefined }), /did not verify/u],
    ['carrying another browser’s nonce', () => idToken({ nonce: 'someone-elses' }), /nonce did not match/u],
  ])('refuses one %s', async (_case, make, reason) => {
    const failure = exchangeOf(await make())

    await expect(failure).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failure).rejects.toThrow(reason)
  })

  it.each([
    ['null', null],
    ['blank, which is what an expired cookie reads as', '   '],
  ])('refuses to exchange when the stored nonce is %s', async (_case, nonce) => {
    const { provider, apple } = rig(replyWith(''))

    await expect(provider.exchange({ ...EXCHANGE, nonce })).rejects.toBeInstanceOf(OAuthExchangeFailed)
    // Refused before the code is spent: an exchange with no browser binding
    // must not reach Apple at all.
    expect(apple.tokenPosts).toHaveLength(0)
  })
})

describe('a token endpoint that misbehaves', () => {
  it.each([
    ['names its error', () => Promise.resolve(json(400, { error: 'invalid_grant' })), /invalid_grant/u],
    // An edge failure answers in HTML; an unguarded `json()` would throw
    // SyntaxError straight past this port and out as a 500.
    ['answers in HTML', () => Promise.resolve(new Response('<html>502</html>', { status: 502 })), /502/u],
    ['succeeds without an id_token', () => Promise.resolve(json(200, { access_token: 'a' })), /no id_token/u],
    ['answers 200 with HTML', () => Promise.resolve(new Response('<html>ok</html>')), /no id_token/u],
  ])('fails the sign-in when the endpoint %s', async (_case, reply, reason) => {
    const failure = rig(reply).provider.exchange(EXCHANGE)

    await expect(failure).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failure).rejects.toThrow(reason)
  })

  it('turns a timed-out request into a sign-in failure, not an AbortError', async () => {
    const timeout = (): Promise<Response> =>
      Promise.reject(new DOMException('The operation timed out', 'TimeoutError'))

    const failure = rig(timeout).provider.exchange(EXCHANGE)

    // The distinction that matters: unwrapped, this reaches the route as an
    // unhandled 500 instead of a sign-in failure the route can explain.
    await expect(failure).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failure).rejects.toThrow(/could not be reached/u)
  })
})

describe('the client secret Apple makes us mint', () => {
  it('is an ES256 JWT naming the key, the team and the Services ID, expiring inside Apple’s cap', async () => {
    const { provider, apple } = rig(replyWith(await idToken()))

    await provider.exchange(EXCHANGE)
    const secret = apple.field('client_secret')
    const payload = decodeJwt(secret)
    const exp = payload.exp ?? 0

    // `kid` is how Apple picks the key to verify against; omit it and the only
    // answer is `invalid_client`, with no further detail.
    expect(decodeProtectedHeader(secret)).toStrictEqual({ alg: 'ES256', kid: KEY_ID })
    // Team issues, Services ID is the subject, Apple is the audience. Swapping
    // iss and sub is the most common `invalid_client` there is.
    expect(payload).toMatchObject({ iss: TEAM_ID, sub: SERVICES_ID, aud: APPLE })
    // Stamped from the ClockPort, not the wall clock — which is what lets the
    // renewal test below move time at all.
    expect(payload.iat).toBe(NOW_SECONDS)
    expect(exp).toBeGreaterThan(NOW_SECONDS)
    // Measured on APPLE's clock: a secret over the six-month cap is refused
    // outright, and then every sign-in fails at once.
    expect(exp - NOW_SECONDS).toBeLessThanOrEqual(APPLE_MAX_SECRET_LIFETIME)
  })

  it('reuses the cached secret on a second exchange rather than re-signing', async () => {
    const clock = new FakeClock(NOW)
    const { provider, apple } = rig(replyWith(await idToken()), clock)

    await provider.exchange(EXCHANGE)
    clock.advance(DAY_MS)
    await provider.exchange(EXCHANGE)

    // Byte-identical: a fresh signature would spend a PKCS#8 import and an
    // ECDSA sign on every sign-in for a credential that outlives the deploy.
    expect(apple.field('client_secret', 1)).toBe(apple.field('client_secret'))
    expect(apple.tokenPosts).toHaveLength(2)
  })

  it('re-signs once the cached secret is near its own expiry', async () => {
    const clock = new FakeClock(NOW)
    const { provider, apple } = rig(replyWith(await idToken()), clock)

    await provider.exchange(EXCHANGE)
    clock.advance(150 * DAY_MS)
    await provider.exchange(EXCHANGE)

    // The failure this guards: a six-month-old secret presented forever, until
    // Apple answers `invalid_client` and nobody can sign in at all.
    expect(apple.field('client_secret', 1)).not.toBe(apple.field('client_secret'))
    expect(decodeJwt(apple.field('client_secret', 1)).iat).toBe(NOW_SECONDS + 150 * 24 * 60 * 60)
  })

  it('fails the sign-in, without leaking key material, when the .p8 is unusable', async () => {
    const { provider, apple } = rig(replyWith(''), new FakeClock(NOW), { privateKeyPkcs8: 'not a pem' })

    const failure = provider.exchange(EXCHANGE)

    await expect(failure).rejects.toBeInstanceOf(OAuthExchangeFailed)
    // The parse error is dropped deliberately: it is the one message in this
    // adapter that could carry private key bytes into a log line.
    await expect(failure).rejects.toThrow(/client secret could not be signed/u)
    expect(apple.tokenPosts).toHaveLength(0)
  })
})
