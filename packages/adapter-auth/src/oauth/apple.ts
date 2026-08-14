import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify, type JWTPayload } from 'jose'
import {
  OAuthExchangeFailed,
  type AuthorizationRequest,
  type ExternalUser,
  type OAuthProvider,
  type SecretGenerator,
} from '@kurasikapa/application'

/**
 * Sign in with Apple, web flow (Services ID, not the native ASAuthorization one).
 *
 * Three things separate Apple from Google and Facebook, and all three change
 * how the callers around this adapter must be written:
 *
 * 1. There is no stored client secret. `client_secret` is an ES256 JWT this
 *    adapter mints from the .p8 signing key and Apple caps at six months.
 * 2. The callback is an HTTP **POST**. `response_mode=form_post` is mandatory
 *    once any scope is requested, so the route handler reads `code`, `state`
 *    and `user` from the FORM BODY — `await request.formData()` — not from
 *    `searchParams`. A handler written against the query string sees nothing
 *    and reports every successful sign-in as a cancelled one.
 * 3. The user's name is sent once in a lifetime, in that `user` form field,
 *    and never in the id_token. See `toExternalUser`.
 */
const ISSUER = 'https://appleid.apple.com'
const AUTHORIZE_ENDPOINT = `${ISSUER}/auth/authorize`
const TOKEN_ENDPOINT = `${ISSUER}/auth/token`
const JWKS_ENDPOINT = `${ISSUER}/auth/keys`

/**
 * Pinned from Apple's discovery document: `id_token_signing_alg_values_supported`
 * is `["RS256"]` and the client secret must be ES256. Naming both stops a
 * token nominating its own algorithm, which is the classic JWT forgery.
 */
const ID_TOKEN_ALGORITHM = 'RS256'
const CLIENT_SECRET_ALGORITHM = 'ES256'

/**
 * Apple rejects a client secret whose `exp` is more than 15,777,000 seconds
 * (six months) out, measured on APPLE's clock rather than ours. 150 days
 * leaves a month of slack, so a server clock running fast cannot push the
 * secret over the cap and turn every sign-in into `invalid_client`.
 */
const SECRET_LIFETIME_SECONDS = 150 * 24 * 60 * 60

/** Re-sign a day early: a request that starts before `exp` must not arrive after it. */
const SECRET_RENEWAL_MARGIN_MS = 24 * 60 * 60 * 1000

export interface AppleOAuthConfig {
  /**
   * The **Services ID** — the web client's identifier. Not the App ID and
   * never the Team ID; Apple warns that a Team ID here leaks it to end users.
   * It is also the id_token audience, so getting it wrong fails closed.
   */
  readonly servicesId: string
  /** 10-character Team ID. Issues the client secret. */
  readonly teamId: string
  /** 10-character Key ID of the .p8 key, carried in the JWT header as `kid`. */
  readonly keyId: string
  /**
   * The .p8 file's contents, PEM PKCS#8. Env vars usually hold this with
   * literal `\n` sequences; unescaping it is the composition root's job, the
   * same way `JoseTokenSignerConfig` validates its secret length there.
   */
  readonly privateKeyPkcs8: string
}

interface SignedClientSecret {
  readonly jwt: string
  readonly renewAtMs: number
}

export class AppleOAuthProvider implements OAuthProvider {
  readonly provider = 'apple' as const

  /**
   * One key set for the adapter's lifetime. `createRemoteJWKSet` caches
   * Apple's keys and rate-limits its own refresh; building one per call would
   * hit /auth/keys on every sign-in and eventually be throttled, which
   * surfaces as intermittent "signature did not verify" — the hardest kind of
   * failure to reproduce.
   */
  private readonly jwks = createRemoteJWKSet(new URL(JWKS_ENDPOINT))

  private cachedSecret: SignedClientSecret | null = null

  constructor(
    private readonly config: AppleOAuthConfig,
    private readonly secrets: SecretGenerator,
  ) {}

  /**
   * Not `async`: nothing here awaits, and an async function with no await
   * trips `require-await`. The port returns a Promise because other providers
   * fetch discovery documents at this point; Apple's endpoints are fixed.
   */
  authorization(input: { readonly redirectUri: string }): Promise<AuthorizationRequest> {
    const state = this.secrets.token(32)
    const nonce = this.secrets.token(32)

    const params = new URLSearchParams({
      client_id: this.config.servicesId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      // `name` is the only chance to learn the person's name — see
      // `toExternalUser` — and requesting any scope is what makes form_post
      // mandatory below.
      scope: 'name email',
      response_mode: 'form_post',
      state,
      nonce,
    })

    const url = new URL(AUTHORIZE_ENDPOINT)
    // Apple documents the scope separator as `%20`; URLSearchParams writes a
    // space as `+`. The rewrite is total rather than lucky: after
    // serialisation a bare `+` can only be a space, because a literal plus in
    // a value is already `%2B`.
    url.search = params.toString().replace(/\+/g, '%20')

    return Promise.resolve({
      url: url.toString(),
      state,
      nonce,
      // No PKCE. Apple's discovery document advertises no
      // `code_challenge_methods_supported`, and /auth/token authenticates the
      // client with `client_secret_post` instead; a challenge sent anyway is
      // ignored, so returning a verifier here would be security theatre that
      // reads like protection. What actually guards the code is the client
      // secret only we can mint, the code's single use inside five minutes,
      // and the nonce below binding the id_token to this browser.
      codeVerifier: null,
    })
  }

  /** `codeVerifier` is ignored — Apple has no PKCE. See `authorization`. */
  async exchange(input: {
    readonly code: string
    readonly redirectUri: string
    readonly nonce: string | null
    readonly codeVerifier: string | null
  }): Promise<ExternalUser> {
    if (input.nonce === null) {
      // Refusing is the point. Without the nonce we cannot tell an id_token
      // minted for this browser from one an attacker obtained elsewhere and
      // replayed into this callback.
      throw new OAuthExchangeFailed('apple', 'authorization was started without a nonce')
    }

    const idToken = await this.redeem(input.code, input.redirectUri)

    return toExternalUser(await this.verifyIdToken(idToken, input.nonce))
  }

  private async redeem(code: string, redirectUri: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.servicesId,
      client_secret: await this.currentClientSecret(),
      code,
      grant_type: 'authorization_code',
      // Compared byte-for-byte against the URI in the authorization request:
      // a trailing slash difference comes back as `invalid_grant`.
      redirect_uri: redirectUri,
    })

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    // Guarded because an edge failure answers in HTML, and an unguarded
    // `json()` would throw SyntaxError straight past this port's error
    // vocabulary and into the caller as an unhandled 500.
    const payload: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      throw new OAuthExchangeFailed('apple', errorCode(payload, response.status))
    }

    if (!isObject(payload) || typeof payload['id_token'] !== 'string') {
      throw new OAuthExchangeFailed('apple', 'token response carried no id_token')
    }

    return payload['id_token']
  }

  private async verifyIdToken(idToken: string, nonce: string): Promise<JWTPayload> {
    let payload: JWTPayload

    try {
      // Narrow try: it wraps ONLY the jose call, so the nonce check below
      // keeps its own reason instead of being flattened into "did not verify".
      ;({ payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ISSUER,
        // An id_token minted for a different Apple client is genuine and
        // correctly signed. The audience is the only thing that makes it ours.
        audience: this.config.servicesId,
        algorithms: [ID_TOKEN_ALGORITHM],
        // `nonce` is required, not merely compared. A token carrying no nonce
        // would otherwise slip past the check below by being absent — which
        // is exactly what an attacker's own nonce-less sign-in would produce.
        requiredClaims: ['sub', 'nonce'],
      }))
    } catch {
      // No cause attached: jose's message can quote the token.
      throw new OAuthExchangeFailed('apple', 'id_token did not verify')
    }

    if (typeof payload['nonce'] !== 'string' || !this.secrets.equals(payload['nonce'], nonce)) {
      throw new OAuthExchangeFailed('apple', 'nonce did not match')
    }

    return payload
  }

  /**
   * The `client_secret`, signed at most twice a year.
   *
   * Apple's client secret is a JWT we mint rather than a string we store.
   * Signing one per request would spend an ECDSA signature and a PKCS#8
   * import on every sign-in for a credential that stays valid for months, so
   * it is cached until shortly before its own `exp`.
   */
  private async currentClientSecret(): Promise<string> {
    // Ambient time, deliberately, against AGENTS.md § 5's default. What is
    // being measured is this credential's TTL as Apple's servers see it, not
    // a rule the domain owns: nothing below the composition root branches on
    // this number, and a wrong "now" costs one extra signature, never a wrong
    // authorisation decision.
    const nowMs = new Date().getTime()
    const cached = this.cachedSecret

    if (cached !== null && nowMs < cached.renewAtMs) {
      return cached.jwt
    }

    const jwt = await this.signClientSecret(Math.floor(nowMs / 1000))
    this.cachedSecret = {
      jwt,
      renewAtMs: nowMs + SECRET_LIFETIME_SECONDS * 1000 - SECRET_RENEWAL_MARGIN_MS,
    }

    return jwt
  }

  private async signClientSecret(issuedAt: number): Promise<string> {
    try {
      const key = await importPKCS8(this.config.privateKeyPkcs8, CLIENT_SECRET_ALGORITHM)

      return await new SignJWT()
        // `kid` is how Apple chooses which of your keys to verify against.
        // Omit it and the answer is `invalid_client` with no further detail.
        .setProtectedHeader({ alg: CLIENT_SECRET_ALGORITHM, kid: this.config.keyId })
        // Team issues it, Services ID is its subject, Apple is the audience.
        // Swapping iss and sub is the most common `invalid_client` there is.
        .setIssuer(this.config.teamId)
        .setSubject(this.config.servicesId)
        .setAudience(ISSUER)
        // Absolute Unix seconds, from the same clock read the cache budgeted
        // against. A string would mean "a span from now" and read jose's
        // clock instead, letting the cache outlive the token it caches.
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + SECRET_LIFETIME_SECONDS)
        .sign(key)
    } catch {
      // The cause is dropped on purpose. This is a configuration fault, and
      // the underlying key-parsing error is the one message in this file that
      // could carry private key material into a log line.
      throw new OAuthExchangeFailed('apple', 'client secret could not be signed')
    }
  }
}

/**
 * The verified claims, reduced to the port's shape.
 *
 * `displayName` is always null, and that is Apple's design rather than an
 * omission here. The name is sent ONCE — on the user's first authorization,
 * as JSON in the `user` field of the form_post body, alongside `code`. It is
 * never in the id_token and never sent again, on any later sign-in, and there
 * is no endpoint to ask. A route that wants the name must read it from that
 * form body the first time and store it then; there is no second chance.
 */
function toExternalUser(payload: JWTPayload): ExternalUser {
  const subject = payload.sub

  if (subject === undefined || subject === '') {
    throw new OAuthExchangeFailed('apple', 'id_token carried no subject')
  }

  // Apple may return a private relay address (`is_private_email`). It is a
  // verified address and correct for matching an account, but it forwards
  // through a relay the user can switch off, so it is not a durable way to
  // reach anyone.
  const email = typeof payload['email'] === 'string' ? payload['email'] : null

  return {
    provider: 'apple',
    subject,
    email,
    emailVerified: email !== null && isTrue(payload['email_verified']),
    displayName: null,
  }
}

/**
 * Apple documents `email_verified` as a boolean and sends it as the string
 * `"true"` on several paths — a quirk it has never fixed. `=== true` alone
 * silently downgrades every Apple email to unverified, which blocks account
 * matching; a truthy test upgrades the string `"false"` to verified, which is
 * account takeover. Both spellings, explicitly, and nothing else.
 */
const isTrue = (claim: unknown): boolean => claim === true || claim === 'true'

/** Apple's failure body is `{"error":"invalid_grant"}`; the code and the secret stay out of it. */
function errorCode(payload: unknown, status: number): string {
  if (isObject(payload) && typeof payload['error'] === 'string') {
    return payload['error']
  }

  return `token endpoint returned ${String(status)}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
