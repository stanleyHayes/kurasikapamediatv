import { base64url, createRemoteJWKSet, jwtVerify, type RemoteJWKSet } from 'jose'
import type {
  AuthorizationRequest,
  ExternalUser,
  OAuthProvider,
  SecretGenerator,
} from '@kurasikapa/application'
import { assertedTrue, failOAuth, joseErrorCode, nonEmptyString } from './claims'
import { requestWithTimeout, timeoutFrom, type FetchLike } from './http'

/**
 * Google sign-in over OpenID Connect.
 *
 * The endpoints are transcribed from Google's discovery document rather than
 * fetched at runtime. Discovery would put a second round trip on the critical
 * path of every sign-in and a second thing that can be down; these URLs have
 * not moved in a decade, and if they do, this file is the one place to change.
 */
const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

/**
 * Google accepts BOTH spellings of its own issuer and tokens carrying either
 * are in circulation. Rejecting the bare form rejects valid tokens; leaving
 * `issuer` unset accepts a well-formed token minted by anybody whose keys we
 * happened to trust. Exactly these two.
 */
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** The only algorithm discovery advertises, pinned so a token cannot nominate
 * its own — the classic JWT forgery, `alg: none` included. */
const ALGORITHM = 'RS256'

/** `openid` yields the id_token, `email` the claim we match accounts on, `profile` the display name. */
const SCOPE = 'openid email profile'

/** 32 bytes is 43 base64url characters — exactly the minimum RFC 7636 allows for a PKCE verifier. */
const ENTROPY_BYTES = 32

export interface GoogleOAuthConfig {
  readonly clientId: string
  /** Never appears in a URL or a log line; it is only ever a form field on the token POST. */
  readonly clientSecret: string
  /** Milliseconds before a stalled token endpoint is abandoned. See http.ts. */
  readonly timeoutMs?: number
}

/** The id_token claims we read. Every field is `unknown` on purpose: these
 * arrive as parsed JSON from outside the system, and typing one as `string`
 * would be an assertion we have not yet earned. */
interface GoogleIdTokenClaims {
  readonly sub?: unknown
  readonly nonce?: unknown
  readonly email?: unknown
  readonly email_verified?: unknown
  readonly name?: unknown
}

export class GoogleOAuthProvider implements OAuthProvider {
  readonly provider = 'google' as const

  private readonly jwks: RemoteJWKSet
  private readonly timeoutMs: number

  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly secrets: SecretGenerator,
    // Optional and last, so no call site changes. Injectable because `vi.mock`
    // is banned: a fake here is the only way to test the exchange offline.
    private readonly http: FetchLike = fetch,
  ) {
    // Built once per instance, not per call. jose caches the key set and holds
    // a cooldown between fetches, so a flood of tokens carrying an unknown
    // `kid` cannot turn our sign-in route into a load generator against Google.
    this.jwks = createRemoteJWKSet(new URL(JWKS_URI))
    this.timeoutMs = timeoutFrom(config.timeoutMs)
  }

  /** Not `async`: the URL is built from local entropy alone. The port is
   * asynchronous for providers that do need I/O here, and a resolved promise
   * costs nothing. */
  authorization(input: { readonly redirectUri: string }): Promise<AuthorizationRequest> {
    const state = this.secrets.token(ENTROPY_BYTES)
    const nonce = this.secrets.token(ENTROPY_BYTES)
    const codeVerifier = this.secrets.token(ENTROPY_BYTES)

    const url = new URL(AUTHORIZATION_ENDPOINT)
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state,
      // Binds the id_token to this browser's sign-in. Without it a token
      // legitimately minted for one visitor can be replayed into another's
      // callback, and every signature check would still pass.
      nonce,
      code_challenge: this.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      // We never call a Google API on the reader's behalf, so we decline the
      // refresh token. A credential we do not use is a credential we would
      // still have to store, rotate and explain in a breach.
      access_type: 'online',
    }).toString()

    return Promise.resolve({ url: url.toString(), state, nonce, codeVerifier })
  }

  async exchange(input: {
    readonly code: string
    readonly redirectUri: string
    readonly nonce: string | null
    readonly codeVerifier: string | null
  }): Promise<ExternalUser> {
    // The port allows both to be null because Facebook has no nonce and Apple
    // no PKCE; Google has both, so a callback missing either means the stored
    // request was lost or forged. Treating it as optional downgrades this
    // sign-in to one with no replay and no code-interception defence — and it
    // still succeeds, which is the dangerous part.
    if (input.nonce === null || input.codeVerifier === null) {
      fail('this sign-in was started without a nonce and PKCE verifier')
    }

    const idToken = await this.redeem({
      code: input.code,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
    })

    return this.identityFrom(idToken, input.nonce)
  }

  /**
   * BASE64URL(SHA-256(verifier)), per RFC 7636 § 4.2.
   *
   * The digest comes from the injected `SecretGenerator` — hex encoded, hence
   * the re-encoding — rather than from `node:crypto`, keeping the repository's
   * ban on ambient crypto below the composition root intact.
   */
  private codeChallenge(verifier: string): string {
    const hex = this.secrets.sha256(verifier)
    const bytes = new Uint8Array(hex.length / 2)

    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }

    return base64url.encode(bytes)
  }

  /** Trades the authorization code for the id_token, and returns nothing else. */
  private async redeem(input: {
    readonly code: string
    readonly redirectUri: string
    readonly codeVerifier: string
  }): Promise<string> {
    // Narrow try: it wraps ONLY the network call, so a bug in our own parsing
    // below cannot be mistaken for Google being unreachable. It also catches
    // the deadline — an aborted fetch rejects, and unwrapped that reaches the
    // route as a 500 rather than as a failed sign-in.
    let response: Response
    try {
      response = await requestWithTimeout(this.http, {
        url: TOKEN_ENDPOINT,
        method: 'POST',
        timeoutMs: this.timeoutMs,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        // The secret travels in the body, never the query string: URLs reach
        // proxy logs, browser history and error trackers; POST bodies do not.
        body: new URLSearchParams({
          code: input.code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: input.codeVerifier,
        }),
      })
    } catch {
      fail('the token endpoint could not be reached')
    }

    // The status alone. Google's error body is provider-controlled text that
    // would land verbatim in our logs, and the status already separates a
    // misconfigured client (401) from a spent or replayed code (400).
    if (!response.ok) fail(`the token endpoint returned ${String(response.status)}`)

    const body: unknown = await response.json().catch(() => null)
    const idToken = (body as { id_token?: unknown } | null)?.id_token

    // Reachable in practice: drop `openid` from the scope and Google returns a
    // perfectly successful OAuth response with no id_token in it at all.
    if (typeof idToken !== 'string') fail('the token response carried no id_token')

    return idToken
  }

  /**
   * Verifies the id_token and reduces it to the identity the domain wants.
   *
   * Signature, issuer and audience are jose's; the nonce is ours, because no
   * JWT library checks it — it is an OIDC claim, not a JWT one. A token that
   * verifies perfectly while carrying somebody else's nonce is exactly the
   * replay this flow exists to stop.
   */
  private async identityFrom(idToken: string, nonce: string): Promise<ExternalUser> {
    let claims: GoogleIdTokenClaims
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        algorithms: [ALGORITHM],
        issuer: ISSUERS,
        audience: this.config.clientId,
        // `exp` is not required by default; a token minted without one would
        // otherwise verify happily and remain redeemable forever.
        requiredClaims: ['sub', 'exp', 'iat'],
      })
      claims = payload
    } catch (error) {
      fail(`the id_token did not verify (${joseErrorCode(error)})`)
    }

    const subject = nonEmptyString(claims.sub)
    if (subject === null) fail('the id_token carried no subject')

    const presented = nonEmptyString(claims.nonce)
    if (presented === null || !this.secrets.equals(presented, nonce)) {
      fail('the id_token nonce did not match this sign-in')
    }

    const email = nonEmptyString(claims.email)

    return {
      provider: this.provider,
      subject,
      email,
      emailVerified: email !== null && assertedTrue(claims.email_verified),
      displayName: nonEmptyString(claims.name),
    }
  }
}

/** This provider's name, bound once. See `failOAuth` for what may go in a reason. */
function fail(reason: string): never {
  failOAuth('google', reason)
}
