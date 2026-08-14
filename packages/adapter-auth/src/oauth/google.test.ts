import { createHash } from 'node:crypto'
import { SignJWT, exportJWK, generateKeyPair, type JWTPayload } from 'jose'
import { afterEach, describe, expect, it } from 'vitest'
import { OAuthExchangeFailed, type ExternalUser, type SecretGenerator } from '@kurasikapa/application'
import { GoogleOAuthProvider } from './google'

/**
 * The whole verification path runs for real here.
 *
 * A real RSA key pair is generated in this file, real id_tokens are signed with
 * it, and a real JWKS carrying its public half is served from a hand-written
 * fake transport (`vi.mock` is banned — AGENTS.md § 4). Stubbing `jwtVerify`
 * would leave every assertion below testing the stub: a suite that passes just
 * as happily against an adapter that skips signature checking altogether is
 * worse than no suite, because it reads like proof.
 *
 * jose resolves the JWKS through the GLOBAL fetch — `createRemoteJWKSet` is
 * built without a custom transport — while the token exchange goes through the
 * injected `FetchLike`. Both are pointed at the same fake, and the global is
 * restored after every test so no network call can escape this file.
 */

const CLIENT_ID = '1002.apps.googleusercontent.com'
const CLIENT_SECRET = 'GOCSPX-fake-secret-for-tests'
const REDIRECT_URI = 'https://kurasikapa.tv/api/auth/google/callback'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'
const AUTH_ORIGIN = 'https://accounts.google.com'
const KID = 'kurasikapa-test-key'
const SUBJECT = '110169484474386276334'
const EMAIL = 'ama@kurasikapa.tv'
const NAME = 'Ama Serwaa'
const CODE = 'code-abc'

/** The second and third values `SequentialSecrets` issues — see `authorization`. */
const NONCE = 'secret-2'
const VERIFIER = 'secret-3'

/**
 * Absolute epoch seconds, never a span from "now".
 *
 * AGENTS.md § 5 bans reading the ambient clock below the composition root, and
 * `new Date().getTime()` is the same read wearing a hat. jose still compares
 * `exp` against the real clock inside `jwtVerify`, so the expiry is a fixed
 * literal far enough out that this suite cannot start failing on a calendar
 * date nobody would connect to it.
 */
const IAT = 1_600_000_000
const EXP = 7_258_118_400

const signing = await generateKeyPair('RS256', { extractable: true })
const foreign = await generateKeyPair('RS256', { extractable: true })
const JWKS = {
  keys: [{ ...(await exportJWK(signing.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }],
}

/**
 * Deterministic secrets with a REAL sha256.
 *
 * The digest has to be genuine hex, because the adapter decodes it back to
 * bytes to build the PKCE challenge. A fake returning `sha256(x)` would make
 * that decode produce NaN bytes and the challenge assertion meaningless.
 */
class SequentialSecrets implements SecretGenerator {
  readonly requested: number[] = []
  private issued = 0

  token(bytes: number): string {
    this.requested.push(bytes)
    this.issued += 1

    return `secret-${String(this.issued)}`
  }

  sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex')
  }

  equals(a: string, b: string): boolean {
    return a === b
  }
}

type TokenResponder = (form: URLSearchParams, init: RequestInit | undefined) => Promise<Response>

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

/** `String(input)` would trip `no-base-to-string` on a `Request`; this is total. */
function targetOf(input: Parameters<typeof globalThis.fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href

  return input.url
}

/**
 * The only network this suite has.
 *
 * An unknown endpoint THROWS rather than 404s: a silent empty response would
 * let a typo in an endpoint constant read as a plain sign-in failure, which is
 * exactly the bug this file should be catching.
 */
function network(respond: TokenResponder): typeof globalThis.fetch {
  return async (input, init) => {
    const url = targetOf(input)
    if (url === JWKS_URI) return jsonResponse(JWKS)
    if (url !== TOKEN_ENDPOINT) throw new Error(`unexpected request to ${url}`)

    const body = init?.body

    return respond(new URLSearchParams(body instanceof URLSearchParams ? body : ''), init)
  }
}

function serves(idToken: unknown): TokenResponder {
  return () => Promise.resolve(jsonResponse({ access_token: 'ya29.fake', id_token: idToken }))
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function google(respond: TokenResponder, timeoutMs?: number): GoogleOAuthProvider {
  const fake = network(respond)
  globalThis.fetch = fake
  const base = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }
  // Conditional spread, not `timeoutMs: undefined` — `exactOptionalPropertyTypes`
  // makes an explicit undefined a type error on an optional field.
  const config = timeoutMs === undefined ? base : { ...base, timeoutMs }

  return new GoogleOAuthProvider(config, new SequentialSecrets(), fake)
}

function exchangeWith(respond: TokenResponder, nonce = NONCE, verifier = VERIFIER): Promise<ExternalUser> {
  return google(respond).exchange({ code: CODE, redirectUri: REDIRECT_URI, nonce, codeVerifier: verifier })
}

interface Forge {
  readonly claims?: JWTPayload
  readonly issuer?: string
  readonly audience?: string
  readonly key?: typeof signing.privateKey
  /** Drops `exp` entirely. A claim overridden to `undefined` cannot express
   * this one: `exp?: number` refuses undefined under `exactOptionalPropertyTypes`. */
  readonly noExpiry?: boolean
}

/** A claim set to `undefined` is dropped by `JSON.stringify`, which is how the
 * "absent claim" cases below remove one. */
function idToken(forge: Forge = {}): Promise<string> {
  const base = { sub: SUBJECT, iat: IAT, nonce: NONCE, email: EMAIL, email_verified: true, name: NAME }
  const payload: JWTPayload = { ...base, ...forge.claims }
  if (forge.noExpiry !== true) payload.exp = EXP

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(forge.issuer ?? AUTH_ORIGIN)
    .setAudience(forge.audience ?? CLIENT_ID)
    .sign(forge.key ?? signing.privateKey)
}

/** `alg: none` cannot come out of a signer, so it is assembled by hand. */
function unsignedToken(): string {
  const seg = (value: unknown): string =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  const claims = { sub: SUBJECT, iss: AUTH_ORIGIN, aud: CLIENT_ID, iat: IAT, exp: EXP, nonce: NONCE }

  return `${seg({ alg: 'none', kid: KID, typ: 'JWT' })}.${seg(claims)}.`
}

/** Genuinely signed, just with the wrong family — the algorithm-confusion forgery. */
function hmacToken(): Promise<string> {
  return new SignJWT({ sub: SUBJECT, iat: IAT, exp: EXP, nonce: NONCE })
    .setProtectedHeader({ alg: 'HS256', kid: KID })
    .setIssuer(AUTH_ORIGIN)
    .setAudience(CLIENT_ID)
    .sign(new TextEncoder().encode('h'.repeat(32)))
}

describe('the authorization URL', () => {
  const secrets = new SequentialSecrets()
  const config = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }
  const provider = new GoogleOAuthProvider(config, secrets)

  it('carries every parameter Google requires, and no secret', async () => {
    const { url } = await provider.authorization({ redirectUri: REDIRECT_URI })
    const parsed = new URL(url)

    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${AUTH_ORIGIN}/o/oauth2/v2/auth`)
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code',
      // `openid` is what makes the response carry an id_token at all; without
      // it Google answers 200 with nothing to verify.
      scope: 'openid email profile', code_challenge_method: 'S256', access_type: 'online',
    })
    for (const name of ['state', 'nonce', 'code_challenge']) {
      expect(parsed.searchParams.get(name)).not.toBeNull()
    }
    expect(url).not.toContain(CLIENT_SECRET)
  })

  it('returns the state, nonce and verifier the callback must check, at 32 bytes each', async () => {
    const request = await provider.authorization({ redirectUri: REDIRECT_URI })
    const parsed = new URL(request.url)

    expect(parsed.searchParams.get('state')).toBe(request.state)
    expect(parsed.searchParams.get('nonce')).toBe(request.nonce)
    // The verifier is the one secret that must NOT travel to Google here — it
    // is held server-side and presented only at the exchange.
    expect(request.url).not.toContain(request.codeVerifier)
    expect(secrets.requested.slice(-3)).toStrictEqual([32, 32, 32])
  })

  it('derives the PKCE challenge from the RAW sha256 bytes, not the hex text', async () => {
    // The mistake this exists to catch: base64url-ing the 64-character hex
    // STRING instead of the 32 digest bytes. Both are valid base64url, both
    // look plausible in a log, and every provider rejects the second — no fake
    // transport can reveal it, only this arithmetic can.
    const request = await provider.authorization({ redirectUri: REDIRECT_URI })
    const digest = createHash('sha256').update(request.codeVerifier ?? '', 'utf8').digest()
    const challenge = new URL(request.url).searchParams.get('code_challenge')

    expect(challenge).toBe(digest.toString('base64url'))
    expect(challenge).not.toBe(Buffer.from(digest.toString('hex'), 'utf8').toString('base64url'))
    // 32 bytes base64url-encoded, unpadded, is exactly 43 characters (RFC 7636 § 4.2).
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]{43}$/u)
  })
})

describe('a successful exchange', () => {
  it('returns the verified identity', async () => {
    await expect(exchangeWith(serves(await idToken()))).resolves.toStrictEqual({
      provider: 'google', subject: SUBJECT, email: EMAIL, emailVerified: true, displayName: NAME,
    })
  })

  it('sends the code, verifier and client secret in the POST body', async () => {
    // `network` matches the endpoint by exact string, so anything that leaked
    // into the query string would fail the request outright.
    const forms: URLSearchParams[] = []
    const token = await idToken()
    await exchangeWith((form) => {
      forms.push(form)

      return Promise.resolve(jsonResponse({ id_token: token }))
    })

    expect(Object.fromEntries(forms.at(0) ?? [])).toStrictEqual({
      grant_type: 'authorization_code', code: CODE, code_verifier: VERIFIER,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI,
    })
  })

  it('accepts the bare "accounts.google.com" issuer spelling', async () => {
    // Google mints both. Rejecting this one rejects valid tokens.
    const user = await exchangeWith(serves(await idToken({ issuer: 'accounts.google.com' })))

    expect(user.subject).toBe(SUBJECT)
  })

  const verified: readonly [string, unknown, boolean][] = [
    ['a JSON boolean true', true, true],
    ['the string "true", which Google really does send', 'true', true],
    ['a JSON boolean false', false, false],
    // The row that earns this table. A truthy test — `Boolean(claim)` — reads
    // the STRING "false" as verified, and the sign-in use case links a provider
    // identity onto an existing account by matching a verified email. That is
    // account takeover in one step, and every other row here still passes.
    ['the string "false", which any truthy test would promote', 'false', false],
    // Absent is not an assertion either. Nor is anything else: "1", null, 0.
    ['nothing at all', undefined, false],
    ['the string "1"', '1', false],
  ]

  it.each(verified)('reads email_verified given %s as %s', async (_why, claim, expected) => {
    const user = await exchangeWith(serves(await idToken({ claims: { email_verified: claim } })))

    expect(user.emailVerified).toBe(expected)
  })

  it('reports no email, unverified, and no display name when the token carries neither', async () => {
    const forged = await idToken({ claims: { email: undefined, name: undefined } })

    await expect(exchangeWith(serves(forged))).resolves.toMatchObject({
      email: null,
      // `email_verified: true` is still in the claims. A verified flag with no
      // address is not a verified address.
      emailVerified: false,
      displayName: null,
    })
  })
})

describe('id_tokens this adapter must refuse', () => {
  const refusals: readonly [string, () => Promise<string>, RegExp][] = [
    ['signed by a key outside the JWKS', () => idToken({ key: foreign.privateKey }), /did not verify/u],
    ['minted for another audience', () => idToken({ audience: 'other.googleusercontent.com' }), /did not verify/u],
    ['minted by another issuer', () => idToken({ issuer: 'https://accounts.evil.example' }), /did not verify/u],
    ['unsigned, with alg none', () => Promise.resolve(unsignedToken()), /did not verify/u],
    ['forged down to HS256', hmacToken, /did not verify/u],
    // No exp is a token that stays redeemable forever; `requiredClaims` is what
    // stops it, because jose does not demand exp by default.
    ['carrying no exp', () => idToken({ noExpiry: true }), /did not verify/u],
    ['carrying a blank subject', () => idToken({ claims: { sub: '' } }), /carried no subject/u],
    // No JWT library checks the nonce — it is an OIDC claim, not a JWT one. A
    // token that verifies perfectly while carrying somebody else's nonce is
    // precisely the replay this flow exists to stop.
    ['carrying no nonce', () => idToken({ claims: { nonce: undefined } }), /nonce did not match/u],
    ['carrying another nonce', () => idToken({ claims: { nonce: 'secret-99' } }), /nonce did not match/u],
  ]

  it.each(refusals)('refuses one %s', async (_why, build, reason) => {
    const failing = exchangeWith(serves(await build()))

    await expect(failing).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failing).rejects.toThrow(reason)
  })

  // Google supports both, so a callback missing either was forged or dropped.
  // Treating them as optional downgrades the sign-in to one with no replay and
  // no code-interception defence — and it still succeeds, which is the danger.
  it.each([
    ['nonce', null, VERIFIER],
    ['PKCE verifier', NONCE, null],
  ])('refuses to proceed without the stored %s', async (_why, nonce, codeVerifier) => {
    const request = { code: CODE, redirectUri: REDIRECT_URI, nonce, codeVerifier }

    await expect(google(serves('unused')).exchange(request)).rejects.toBeInstanceOf(OAuthExchangeFailed)
  })
})

describe('when the token endpoint misbehaves', () => {
  it('fails the sign-in on an OAuth error body', async () => {
    const error = { error: 'invalid_grant', error_description: 'Bad Request' }
    const failing = exchangeWith(() => Promise.resolve(jsonResponse(error, 400)))

    await expect(failing).rejects.toBeInstanceOf(OAuthExchangeFailed)
    // The status, never the provider's text: that body lands in our logs and
    // may be shown to the person signing in.
    await expect(failing).rejects.toThrow(/returned 400/u)
    await expect(failing).rejects.not.toThrow(/invalid_grant/u)
  })

  it('fails the sign-in on an HTML body rather than crashing on the parse', async () => {
    // A captive portal, a proxy error page or a maintenance splash: status 200,
    // content-type text/html. `response.json()` rejects, and unhandled that is
    // a 500 on the callback route instead of a sign-in failure.
    const page = new Response('<!doctype html><title>502 Bad Gateway</title>', { status: 200 })
    const failing = exchangeWith(() => Promise.resolve(page))

    await expect(failing).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failing).rejects.toThrow(/no id_token/u)
  })

  it('fails the sign-in on a successful response carrying no id_token', async () => {
    // Reachable: drop `openid` from the scope and Google answers 200 with an
    // access token and nothing to verify.
    const failing = exchangeWith(serves(undefined))

    await expect(failing).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failing).rejects.toThrow(/no id_token/u)
  })

  it('wraps a request that hits its deadline instead of leaking the AbortError', async () => {
    const deadlines: (AbortSignal | undefined)[] = []
    // Never resolves. Only the adapter's own deadline can end this request,
    // which is what makes the assertion below about the adapter and not the fake.
    const stalls: TokenResponder = (_form, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal ?? undefined
        deadlines.push(signal)
        // Exactly what `AbortSignal.timeout` produces. Unwrapped it reaches the
        // route as a 500 rather than a sign-in failure it can explain.
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted due to timeout', 'TimeoutError'))
        })
      })
    const request = { code: CODE, redirectUri: REDIRECT_URI, nonce: NONCE, codeVerifier: VERIFIER }
    const failing = google(stalls, 20).exchange(request)

    await expect(failing).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(failing).rejects.toThrow(/could not be reached/u)
    expect(deadlines.at(0)?.aborted).toBe(true)
  })
})
