import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type {
  AuthorizationRequest,
  ClockPort,
  ExternalUser,
  OAuthProvider,
  SecretGenerator,
} from '@kurasikapa/application'
import { APPLE_ISSUER, AppleClientSecret } from './apple-client-secret'
import { asJsonObject, assertedTrue, failOAuth, nonEmptyString } from './claims'
import { requestWithTimeout, timeoutFrom, type FetchLike } from './http'

/**
 * Sign in with Apple, web flow (Services ID, not the native ASAuthorization one).
 *
 * Three things separate Apple from Google and Facebook, and all three change
 * how the callers around this adapter must be written:
 *
 * 1. There is no stored client secret. `client_secret` is an ES256 JWT minted
 *    from the .p8 signing key — see apple-client-secret.ts.
 * 2. The callback is an HTTP **POST**. `response_mode=form_post` is mandatory
 *    once any scope is requested, so the route handler reads `code`, `state`
 *    and `user` from the FORM BODY — `await request.formData()` — not from
 *    `searchParams`. A handler written against the query string sees nothing
 *    and reports every successful sign-in as a cancelled one.
 * 3. The user's name is sent once in a lifetime, in that `user` form field,
 *    never in the id_token. See `toExternalUser`.
 */
const AUTHORIZE_ENDPOINT = `${APPLE_ISSUER}/auth/authorize`
const TOKEN_ENDPOINT = `${APPLE_ISSUER}/auth/token`
const JWKS_ENDPOINT = `${APPLE_ISSUER}/auth/keys`

/** Pinned from Apple's discovery document, whose
 * `id_token_signing_alg_values_supported` is `["RS256"]`. Naming it stops a
 * token nominating its own algorithm — the classic JWT forgery. */
const ID_TOKEN_ALGORITHM = 'RS256'

export interface AppleOAuthConfig {
  /** The **Services ID** — the web client's identifier. Not the App ID and
   * never the Team ID; Apple warns that a Team ID here leaks it to end users.
   * It is also the id_token audience, so getting it wrong fails closed. */
  readonly servicesId: string
  /** 10-character Team ID. Issues the client secret. */
  readonly teamId: string
  /** 10-character Key ID of the .p8 key, carried in the JWT header as `kid`. */
  readonly keyId: string
  /** The .p8 file's contents, PEM PKCS#8. Env vars usually hold this with
   * literal `\n` sequences; unescaping it is the composition root's job, the
   * same way `JoseTokenSignerConfig` validates its secret length there. */
  readonly privateKeyPkcs8: string
  /** Milliseconds before a stalled token endpoint is abandoned. See http.ts. */
  readonly timeoutMs?: number
}

export class AppleOAuthProvider implements OAuthProvider {
  readonly provider = 'apple' as const

  /** One key set for the adapter's lifetime. `createRemoteJWKSet` caches
   * Apple's keys and rate-limits its own refresh; one per call would hit
   * /auth/keys on every sign-in and eventually be throttled, surfacing as
   * intermittent "signature did not verify". */
  private readonly jwks = createRemoteJWKSet(new URL(JWKS_ENDPOINT))
  private readonly clientSecret: AppleClientSecret
  private readonly timeoutMs: number

  constructor(
    private readonly config: AppleOAuthConfig,
    private readonly secrets: SecretGenerator,
    // Required, not defaulted: a default would put `new Date()` back below the
    // composition root, which is the rule the old cache was evading.
    clock: ClockPort,
    // Optional and last, so no call site changes. Injectable because `vi.mock`
    // is banned: a fake here is the only way to test the exchange offline.
    private readonly http: FetchLike = fetch,
  ) {
    this.clientSecret = new AppleClientSecret(config, clock)
    this.timeoutMs = timeoutFrom(config.timeoutMs)
  }

  /** Not `async`: nothing here awaits, and an async function with no await
   * trips `require-await`. The port returns a Promise because other providers
   * fetch discovery documents at this point; Apple's endpoints are fixed. */
  authorization(input: { readonly redirectUri: string }): Promise<AuthorizationRequest> {
    const state = this.secrets.token(32)
    const nonce = this.secrets.token(32)

    const params = new URLSearchParams({
      client_id: this.config.servicesId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      // `name` is the only chance to learn the person's name — see
      // `toExternalUser` — and requesting any scope makes form_post mandatory.
      scope: 'name email',
      response_mode: 'form_post',
      state,
      nonce,
    })

    const url = new URL(AUTHORIZE_ENDPOINT)
    // Apple documents the scope separator as `%20`; URLSearchParams writes a
    // space as `+`. The rewrite is total rather than lucky: after
    // serialisation a bare `+` can only be a space, since a literal plus in a
    // value is already `%2B`.
    url.search = params.toString().replace(/\+/g, '%20')

    return Promise.resolve({
      url: url.toString(),
      state,
      nonce,
      // No PKCE. Apple advertises no `code_challenge_methods_supported` and
      // authenticates the client with `client_secret_post` instead; a
      // challenge sent anyway is ignored, so a verifier here would be security
      // theatre that reads like protection. What guards the code is the client
      // secret only we can mint, its single use inside five minutes, and the
      // nonce binding the id_token to this browser.
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
    // Blank counts as absent, which is the whole point of the trim. A route
    // reading `cookies().get('apple_nonce')?.value ?? ''` hands us '' when the
    // cookie expired or was never set; with '' on both sides the check in
    // `verifyIdToken` passes and the browser binding silently becomes a no-op
    // — the replay this nonce exists to stop, succeeding quietly.
    const nonce = input.nonce?.trim() ?? ''

    if (nonce === '') {
      failOAuth(this.provider, 'authorization was started without a nonce')
    }

    const idToken = await this.redeem(input.code, input.redirectUri)

    return toExternalUser(await this.verifyIdToken(idToken, nonce))
  }

  private async redeem(code: string, redirectUri: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.servicesId,
      client_secret: await this.clientSecret.current(),
      code,
      grant_type: 'authorization_code',
      // Compared byte-for-byte against the URI in the authorization request:
      // a trailing slash difference comes back as `invalid_grant`.
      redirect_uri: redirectUri,
    })

    // Narrow try: it wraps ONLY the network call. An expired deadline rejects
    // here, and unwrapped it reaches the route as a 500 rather than a sign-in
    // failure the route can explain.
    let response: Response
    try {
      response = await requestWithTimeout(this.http, {
        url: TOKEN_ENDPOINT,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeoutMs: this.timeoutMs,
        body,
      })
    } catch {
      failOAuth(this.provider, 'the token endpoint could not be reached')
    }

    // Guarded because an edge failure answers in HTML, and an unguarded
    // `json()` throws SyntaxError straight past this port's error vocabulary
    // and into the caller as an unhandled 500.
    const parsed: unknown = await response.json().catch(() => null)
    const payload = asJsonObject(parsed)

    if (!response.ok) failOAuth(this.provider, errorCode(payload, response.status))

    const idToken = payload === null ? null : nonEmptyString(payload['id_token'])

    if (idToken === null) failOAuth(this.provider, 'token response carried no id_token')

    return idToken
  }

  private async verifyIdToken(idToken: string, nonce: string): Promise<JWTPayload> {
    let payload: JWTPayload
    try {
      // Narrow try: it wraps ONLY the jose call, so the nonce check below
      // keeps its own reason instead of being flattened into "did not verify".
      ;({ payload } = await jwtVerify(idToken, this.jwks, {
        issuer: APPLE_ISSUER,
        // An id_token minted for a different Apple client is genuine and
        // correctly signed. The audience is the only thing that makes it ours.
        audience: this.config.servicesId,
        algorithms: [ID_TOKEN_ALGORITHM],
        // `nonce` is required, not merely compared. A token carrying no nonce
        // would otherwise slip past the check below by being absent — exactly
        // what an attacker's own nonce-less sign-in produces.
        requiredClaims: ['sub', 'nonce'],
      }))
    } catch {
      // No cause attached: jose's message can quote the token.
      failOAuth(this.provider, 'id_token did not verify')
    }

    const presented = nonEmptyString(payload['nonce'])

    if (presented === null || !this.secrets.equals(presented, nonce)) {
      failOAuth(this.provider, 'nonce did not match')
    }

    return payload
  }
}

/**
 * The verified claims, reduced to the port's shape.
 *
 * `displayName` is always null, and that is Apple's design rather than an
 * omission here. The name is sent ONCE — on the first authorization, as JSON
 * in the `user` field of the form_post body — never in the id_token, never
 * again on a later sign-in, and there is no endpoint to ask. A route that
 * wants it must read it from that form body and store it then.
 */
function toExternalUser(payload: JWTPayload): ExternalUser {
  const subject = nonEmptyString(payload.sub)

  if (subject === null) failOAuth('apple', 'id_token carried no subject')

  // Apple may return a private relay address (`is_private_email`). It is a
  // verified address and correct for matching an account, but it forwards
  // through a relay the user can switch off, so it is not a durable contact.
  const email = nonEmptyString(payload['email'])

  return {
    provider: 'apple',
    subject,
    email,
    emailVerified: email !== null && assertedTrue(payload['email_verified']),
    displayName: null,
  }
}

/** Apple's failure body is `{"error":"invalid_grant"}`; the code and the secret stay out of it. */
function errorCode(payload: Record<string, unknown> | null, status: number): string {
  const code = payload === null ? null : nonEmptyString(payload['error'])

  return code ?? `token endpoint returned ${String(status)}`
}
