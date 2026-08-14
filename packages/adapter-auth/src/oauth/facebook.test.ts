import { createHash, createHmac } from 'node:crypto'
import {
  OAuthExchangeFailed,
  type AuthorizationRequest,
  type SecretGenerator,
} from '@kurasikapa/application'
import { describe, expect, it } from 'vitest'
import { FacebookOAuthProvider } from './facebook'
import type { FetchLike } from './http'

/**
 * Facebook sign-in, driven end to end against a hand-written Graph.
 *
 * `vi.mock` is banned (AGENTS.md § 4) and nothing here touches the network:
 * the adapter takes a `FetchLike`, so the whole exchange runs against a fake
 * that records what was sent and decides what comes back.
 *
 * There is no id_token battery in this file — no foreign signing key, no
 * forged `alg`, no replayed nonce — and the absence is the point. The classic
 * flow this adapter implements returns an OPAQUE bearer token that names no
 * audience, so there is nothing signed to verify. `debug_token` is what stands
 * in for the audience check, which is why it gets the longest block below.
 */

const CLIENT_ID = '1234567890'
const CLIENT_SECRET = 'app-secret-that-must-never-reach-a-url'
const CONFIG = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }
const REDIRECT = 'https://kurasikapa.tv/auth/facebook/callback'
const TOKEN = 'EAAG-opaque-bearer'
const DIALOG = 'https://www.facebook.com/v26.0/dialog/oauth'
const EXCHANGE = { code: 'code-abc', redirectUri: REDIRECT, nonce: null, codeVerifier: 'pkce-v' }

/**
 * A real SHA-256, because one assertion here depends on its encoding.
 *
 * `FakeSecretGenerator` in application/testing returns the label `sha256(x)`,
 * which cannot tell a challenge built from the raw digest bytes apart from one
 * built from the hex text. Tokens stay legible so their order and their
 * requested widths can be asserted.
 */
class TestSecrets implements SecretGenerator {
  readonly widths: number[] = []

  token(bytes: number): string { this.widths.push(bytes); return `secret-${String(this.widths.length)}` }

  sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex') }

  equals(a: string, b: string): boolean { return a === b }
}

type Stage = 'token' | 'debug' | 'profile'

interface Call {
  readonly url: string
  readonly method: string
  readonly authorization: string | null
  readonly form: URLSearchParams
}

const OK_TOKEN = { access_token: TOKEN, token_type: 'bearer' }
const OK_DEBUG = { data: { is_valid: true, app_id: CLIENT_ID, scopes: ['email'] } }
const OK_PROFILE = { id: '10223344556677', name: 'Ama Serwaa', email: 'ama@example.com' }

/** What the whole flow is supposed to produce from the three OK_* responses. */
const IDENTITY = {
  provider: 'facebook', subject: OK_PROFILE.id, email: OK_PROFILE.email,
  emailVerified: false, displayName: OK_PROFILE.name,
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status })

/** Which of the three calls this is. The adapter makes them in a fixed order,
 * so the URL identifies the stage and the fake needs no script. */
const stageOf = (url: string): Stage =>
  url.includes('access_token') ? 'token' : url.includes('debug_token') ? 'debug' : 'profile'

/** Meta's Graph, as far as this adapter can tell. Happy by default; each test
 * replaces only the one response it is about. */
class FakeGraph {
  readonly calls: Call[] = []
  private readonly replies = new Map<Stage, () => Response>()

  constructor() { this.reply('token', OK_TOKEN).reply('debug', OK_DEBUG).reply('profile', OK_PROFILE) }

  reply(stage: Stage, body: unknown, status = 200): this { return this.raw(stage, () => json(body, status)) }

  raw(stage: Stage, make: () => Response): this { this.replies.set(stage, make); return this }

  readonly fetch: FetchLike = (url, init) => {
    const body = init?.body
    const form = body instanceof URLSearchParams ? body : new URLSearchParams()
    const authorization = new Headers(init?.headers).get('authorization')

    this.calls.push({ url, method: init?.method ?? 'GET', authorization, form })

    return Promise.resolve((this.replies.get(stageOf(url)) ?? (() => json({}, 500)))())
  }

  /** `!` is deliberate: a stage the adapter never reached is a failed test, and
   * the resulting TypeError names the line as clearly as a message would. */
  seen(stage: Stage): Call { return this.calls.find((made) => stageOf(made.url) === stage)! }

  query(stage: Stage): URLSearchParams { return new URL(this.seen(stage).url).searchParams }
}

const facebook = (graph: FakeGraph, secrets: SecretGenerator = new TestSecrets()): FacebookOAuthProvider =>
  new FacebookOAuthProvider(CONFIG, secrets, graph.fetch)

const authorize = (secrets: SecretGenerator): Promise<AuthorizationRequest> =>
  facebook(new FakeGraph(), secrets).authorization({ redirectUri: REDIRECT })

/** BASE64URL(SHA256(verifier)) — the PKCE challenge, computed independently. */
const challengeFor = (verifier: string): string => createHash('sha256').update(verifier, 'utf8').digest('base64url')

/**
 * Runs an exchange that must fail, and hands back the failure.
 *
 * Every refusal test asserts on the TYPE as well as the message, because
 * `rejects.toThrow` alone also passes for a TypeError thrown while reading a
 * malformed body — which is the exact bug half of these tests exist to catch.
 */
async function exchangeFailure(graph: FakeGraph): Promise<OAuthExchangeFailed> {
  const settled: unknown = await facebook(graph).exchange(EXCHANGE).then(() => null, (error: unknown) => error)

  if (settled instanceof OAuthExchangeFailed) return settled

  throw new Error('the exchange resolved, or failed with the wrong type, where it had to refuse')
}

describe('the authorization request', () => {
  it('carries every parameter Meta requires, and nothing else', async () => {
    const request = await authorize(new TestSecrets())

    // An exhaustive compare rather than a series of `get`s: an EXTRA parameter
    // is as much a defect as a missing one, and only this shape catches it.
    expect(Object.fromEntries(new URL(request.url).searchParams)).toStrictEqual({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      state: request.state,
      response_type: 'code',
      scope: 'public_profile,email',
      code_challenge: challengeFor(request.codeVerifier ?? ''),
      code_challenge_method: 'S256',
    })
    expect(request.url.startsWith(`${DIALOG}?`)).toBe(true)
    // The secret authenticates the token exchange. It belongs nowhere a
    // browser, a proxy or an error tracker can read it.
    expect(request.url).not.toContain(CLIENT_SECRET)
  })

  it('takes state and the verifier from the injected generator, at full width', async () => {
    const secrets = new TestSecrets()
    const request = await authorize(secrets)

    // 32 bytes of state, 64 for the verifier: base64url of 64 bytes is 86
    // characters, inside PKCE's 43–128. A narrower verifier is guessable.
    expect(secrets.widths).toEqual([32, 64])
    expect(request.state).toBe('secret-1')
    expect(request.codeVerifier).toBe('secret-2')
  })

  it('derives the challenge from the RAW sha256 bytes, not from the hex text', async () => {
    const secrets = new TestSecrets()
    const request = await authorize(secrets)
    const verifier = request.codeVerifier ?? ''
    // The mistake this test exists for. `SecretGenerator.sha256` returns hex
    // because token storage wants hex; PKCE compares the digest BYTES. Passing
    // the hex text through builds a plausible-looking challenge that every
    // provider rejects and that no fake would object to — only the real Meta.
    const fromHexText = Buffer.from(secrets.sha256(verifier), 'utf8').toString('base64url')
    const challenge = new URL(request.url).searchParams.get('code_challenge')

    expect(challenge).toBe(challengeFor(verifier))
    expect(challenge).toHaveLength(43)
    expect(challenge).not.toBe(fromHexText)
  })
})

describe('the happy-path exchange', () => {
  it('returns the identity, and only what Meta actually vouches for', async () => {
    expect(await facebook(new FakeGraph()).exchange(EXCHANGE)).toStrictEqual(IDENTITY)
  })

  it('redeems the code in a POST body, so no credential reaches a URL', async () => {
    const graph = new FakeGraph()
    await facebook(graph).exchange(EXCHANGE)
    const call = graph.seen('token')

    expect(call.method).toBe('POST')
    // Meta documents a GET. A URL is the part of a request that proxies, load
    // balancers and error trackers keep, so the parameters travel in the body.
    expect(call.url).not.toContain('?')
    expect(Object.fromEntries(call.form)).toStrictEqual({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT,
      code: EXCHANGE.code, code_verifier: EXCHANGE.codeVerifier,
    })
  })

  it('inspects the token, then reads the profile with an appsecret_proof', async () => {
    const graph = new FakeGraph()
    await facebook(graph).exchange(EXCHANGE)

    // Order is a security property: each call is only trustworthy after the
    // one before it, and the profile is read last of all.
    expect(graph.calls.map((call) => stageOf(call.url))).toEqual(['token', 'debug', 'profile'])
    expect(graph.query('debug').get('input_token')).toBe(TOKEN)
    // `debug_token` has no header form for the inspected token, but the APP
    // access token does, which is what keeps the secret out of the URL.
    expect(graph.seen('debug').authorization).toBe(`Bearer ${CLIENT_ID}|${CLIENT_SECRET}`)
    expect(graph.seen('debug').url).not.toContain(CLIENT_SECRET)
    expect(graph.query('profile').get('fields')).toBe('id,name,email')
    // HMAC-SHA256 of the token keyed by the app secret: proof the call comes
    // from the server holding it, so a stolen token alone reads nothing.
    const proof = createHmac('sha256', CLIENT_SECRET).update(TOKEN).digest('hex')

    expect(graph.query('profile').get('appsecret_proof')).toBe(proof)
    expect(graph.seen('profile').authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('refuses a callback carrying no PKCE verifier, before any network call', async () => {
    const graph = new FakeGraph()
    const started = facebook(graph).exchange({ ...EXCHANGE, codeVerifier: null })

    // We always mint a verifier, so a callback without one did not start here.
    // Continuing would silently downgrade the flow to no PKCE at all.
    await expect(started).rejects.toBeInstanceOf(OAuthExchangeFailed)
    expect(graph.calls).toHaveLength(0)
  })

  it.each([
    ['absent', { token_type: 'bearer' }],
    ['empty', { access_token: '' }],
    ['not a string', { access_token: 42 }],
  ])('refuses a token response whose access token is %s', async (_case, body) => {
    const graph = new FakeGraph().reply('token', body)

    expect((await exchangeFailure(graph)).message).toContain('no access token')
    expect(graph.calls).toHaveLength(1)
  })
})

describe('the app-id barrier', () => {
  /**
   * The most important test in this file.
   *
   * A Facebook access token is opaque and names no audience, and Graph answers
   * `/me` for any valid token whoever issued it. Without this check, anyone who
   * can get people to grant a Meta app THEY control presents the resulting
   * token here and we sign in as whoever it belongs to: account takeover in one
   * request, every call returning 200, nothing in the logs afterwards.
   */
  it('refuses a token minted for somebody else’s Meta app', async () => {
    const other = { data: { is_valid: true, app_id: '90909090', user_id: OK_PROFILE.id } }
    const graph = new FakeGraph().reply('debug', other)
    const failure = await exchangeFailure(graph)

    expect(failure.provider).toBe('facebook')
    expect(failure.message).toContain('issued to another app')
    // It fails BEFORE the profile read — /me would have answered happily.
    expect(graph.calls).toHaveLength(2)
  })

  it.each([
    ['app_id is a number that merely == ours', { data: { is_valid: true, app_id: 1234567890 } }, 'another app'],
    ['is_valid is false — a revoked token still answers 200', { data: { is_valid: false, app_id: CLIENT_ID } }, 'inspect as valid'],
    ['is_valid is the string "true"', { data: { is_valid: 'true', app_id: CLIENT_ID } }, 'inspect as valid'],
    ['is_valid is 1', { data: { is_valid: 1, app_id: CLIENT_ID } }, 'inspect as valid'],
    ['is_valid is absent', { data: { app_id: CLIENT_ID } }, 'inspect as valid'],
    ['data is missing', {}, 'inspect as valid'],
    ['data is a bare string', { data: 'ok' }, 'inspect as valid'],
    ['data is null', { data: null }, 'inspect as valid'],
    ['data is an array', { data: [{ is_valid: true, app_id: CLIENT_ID }] }, 'inspect as valid'],
  ])('refuses an inspection where %s', async (_case, body, reason) => {
    // The last four would be a TypeError on a naive read — `typeof null` is
    // 'object' — and a TypeError leaves the route with an unhandled 500
    // instead of a sign-in failure it can explain.
    const graph = new FakeGraph().reply('debug', body)

    expect((await exchangeFailure(graph)).message).toContain(reason)
    expect(graph.calls).toHaveLength(2)
  })
})

describe('email verification, which Meta never asserts', () => {
  /**
   * `emailVerified: true` is what licenses matching a sign-in onto an EXISTING
   * account. Meta's reference calls this address the one listed on the profile,
   * omitted when "no valid email address is available" — a deliverability word,
   * not a confirmation word, and the User node exposes no verified flag to back
   * the stronger reading. So whatever arrives, the answer is false.
   */
  it.each([
    ['a boolean true', true],
    ['the string "true"', 'true'],
    ['false', false],
    ['absent', undefined],
  ])('reports emailVerified false when the profile carries %s', async (_case, flag) => {
    const flags = flag === undefined ? {} : { email_verified: flag, verified: flag }
    const graph = new FakeGraph().reply('profile', { ...OK_PROFILE, ...flags })

    // The address still comes back: it is fine for display and for creating a
    // NEW account, where there is nobody to impersonate.
    expect(await facebook(graph).exchange(EXCHANGE)).toStrictEqual(IDENTITY)
  })

  it('carries a declined email and a missing name as null', async () => {
    // `email` needs App Review and the person can still decline it on the
    // consent screen, so an absent address is normal, not a failure.
    const graph = new FakeGraph().reply('profile', { id: 'fb-2', email: '' })
    const expected = { ...IDENTITY, subject: 'fb-2', email: null, displayName: null }

    expect(await facebook(graph).exchange(EXCHANGE)).toStrictEqual(expected)
  })

  it('refuses a profile with no id, the one field identity is built on', async () => {
    const graph = new FakeGraph().reply('profile', { name: 'Nameless', email: 'x@example.com' })

    expect((await exchangeFailure(graph)).message).toContain('no id')
  })
})

describe('there is no id_token in this flow', () => {
  it('hands back a null nonce rather than one nobody can check', async () => {
    const request = await authorize(new TestSecrets())

    // Meta binds a nonce only in its OIDC variant. Returning one here would
    // tell the caller to compare it against an id_token that never arrives,
    // and a check nobody performs is worse than none: it reads like one.
    expect(request.nonce).toBeNull()
    expect(request.url).not.toContain('nonce')
  })

  it('is unaffected by the nonce it is handed, present or absent', async () => {
    const withNonce = await facebook(new FakeGraph()).exchange({ ...EXCHANGE, nonce: 'n-1' })
    const without = await facebook(new FakeGraph()).exchange({ ...EXCHANGE, nonce: null })

    expect(withNonce).toStrictEqual(without)
  })

  it('ignores an id_token in the token response entirely', async () => {
    // The `alg: none` forgery a naive OIDC path would swallow: a different
    // subject, another app's audience, a foreign issuer, and a staff address
    // marked verified. Identity here comes from debug_token and /me, so none
    // of it lands — the app-id barrier above is the audience check instead.
    const encode = (part: unknown): string =>
      Buffer.from(JSON.stringify(part), 'utf8').toString('base64url')
    const claims = { sub: 'attacker', aud: '90909090', iss: 'https://evil.example', email: 'editor@kurasikapa.tv', email_verified: true }
    const forged = `${encode({ alg: 'none' })}.${encode(claims)}.`
    const graph = new FakeGraph().reply('token', { ...OK_TOKEN, id_token: forged })

    expect(await facebook(graph).exchange(EXCHANGE)).toStrictEqual(IDENTITY)
  })
})

describe('when Graph misbehaves', () => {
  const STAGES: [Stage, string][] = [['token', 'token exchange'], ['debug', 'token inspection'], ['profile', 'profile lookup']]

  it.each(STAGES)('names the %s stage, and leaks nothing, on an error JSON', async (stage, label) => {
    const error = { error: { message: 'This authorization code has been used.', code: 100 } }
    const failure = await exchangeFailure(new FakeGraph().reply(stage, error, 400))

    // Which call failed is the difference between a misconfigured app and a
    // spent code, so the stage is named and Graph's own message carried...
    expect(failure.message).toContain(label)
    expect(failure.message).toContain('This authorization code has been used.')
    // ...but this message is logged and may be shown to the person signing in,
    // so no credential of any kind may travel in it.
    expect(failure.message).not.toContain(CLIENT_SECRET)
    expect(failure.message).not.toContain(TOKEN)
    expect(failure.message).not.toContain(EXCHANGE.code)
  })

  it.each(STAGES)('refuses HTML from the %s endpoint instead of crashing', async (stage, label) => {
    // Status 200 on purpose: a CDN interstitial or captive portal answers OK
    // with HTML, and `response.json()` REJECTS rather than returning null.
    // Unhandled, that is a 500 on a sign-in that should have failed politely.
    const html = (): Response => new Response('<!doctype html><h1>Bad Gateway</h1>')
    const failure = await exchangeFailure(new FakeGraph().raw(stage, html))

    expect(failure.message).toContain(`${label} returned a body that was not JSON`)
  })

  it('refuses a JSON body that is not an object', async () => {
    // Every provider answers some failure with a bare literal, and indexing
    // one is a TypeError this port has no vocabulary for.
    const failure = await exchangeFailure(new FakeGraph().reply('token', null, 500))

    expect(failure.message).toContain('was not JSON')
  })

  it('falls back to the status when Graph sends an error with no message', async () => {
    const failure = await exchangeFailure(new FakeGraph().reply('token', { error: { code: 1 } }, 503))

    expect(failure.message).toContain('HTTP 503')
  })

  it('reports a stalled endpoint as a sign-in failure, not an AbortError', async () => {
    // The fake never answers. It settles only when the adapter's OWN deadline
    // fires, so this drives the real `AbortSignal.timeout` wiring rather than a
    // pre-rejected promise, and proves the deadline is attached at all. 10ms
    // keeps the suite fast; the production default is five seconds.
    const stalls: FetchLike = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
        })
      })
    const provider = new FacebookOAuthProvider({ ...CONFIG, timeoutMs: 10 }, new TestSecrets(), stalls)

    // Unwrapped, that TimeoutError reaches the route as a 500 rather than as a
    // sign-in failure the page can explain and offer to retry.
    await expect(provider.exchange(EXCHANGE)).rejects.toBeInstanceOf(OAuthExchangeFailed)
    await expect(provider.exchange(EXCHANGE)).rejects.toThrow('token exchange could not be reached')
  })

  it('reports a transport rejection the same way', async () => {
    // DNS failure, refused connection, TLS mismatch: all reject before any
    // Response exists, and none of them mean Meta rejected our credentials.
    const refuses: FetchLike = () => Promise.reject(new TypeError('fetch failed'))
    const provider = new FacebookOAuthProvider(CONFIG, new TestSecrets(), refuses)

    await expect(provider.exchange(EXCHANGE)).rejects.toBeInstanceOf(OAuthExchangeFailed)
  })
})
