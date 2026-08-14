import { createHmac } from 'node:crypto'
import type {
  AuthorizationRequest,
  ExternalUser,
  OAuthProvider,
  SecretGenerator,
} from '@kurasikapa/application'
import { asJsonObject, failOAuth, nonEmptyString } from './claims'
import { DIALOG_URL, GRAPH_URL, GraphClient } from './facebook-graph'
import { timeoutFrom, type FetchLike } from './http'

/**
 * Facebook Login — the classic authorization-code flow.
 *
 * Meta also documents an OIDC variant (`scope=openid` plus a mandatory
 * `nonce`) whose token response carries an id_token we could verify against
 * Meta's JWKS. This adapter stays on the classic flow, which returns an opaque
 * bearer token naming no audience. The guarantee an id_token would have
 * carried is recovered by `assertMintedForThisApp`; that call is the security
 * of this file, not a nicety.
 */

/**
 * `public_profile` is granted by default and covers id and name. `email` needs
 * App Review, and the person can still decline it on the consent screen —
 * which is why a missing address is treated as normal, not as a failure.
 */
const SCOPE = 'public_profile,email'
const PROFILE_FIELDS = 'id,name,email'

/** 32 bytes of state, 64 for the verifier: PKCE allows 43–128 characters and
 * base64url of 64 bytes is 86, comfortably inside it. */
const STATE_BYTES = 32
const VERIFIER_BYTES = 64

export interface FacebookOAuthConfig {
  /** The Meta app id. Public — it is in every authorization URL. */
  readonly clientId: string
  /** The Meta app secret. It never reaches a URL — see `redeem` and
   * `assertMintedForThisApp` for where it travels instead. */
  readonly clientSecret: string
  /** Milliseconds before a stalled Graph call is abandoned. See http.ts. */
  readonly timeoutMs?: number
}

interface ExchangeInput {
  readonly code: string
  readonly redirectUri: string
  readonly nonce: string | null
  readonly codeVerifier: string | null
}

export class FacebookOAuthProvider implements OAuthProvider {
  readonly provider = 'facebook' as const
  private readonly graph: GraphClient

  constructor(
    private readonly config: FacebookOAuthConfig,
    private readonly secrets: SecretGenerator,
    // Optional and last, so no call site changes. Injectable because `vi.mock`
    // is banned: a fake here is the only way to test the exchange offline.
    http: FetchLike = fetch,
  ) {
    this.graph = new GraphClient(http, timeoutFrom(config.timeoutMs))
  }

  /** Not `async`: there is nothing to await, and a needless promise would be
   * one more thing for the caller to get ordering wrong around. */
  authorization(input: { readonly redirectUri: string }): Promise<AuthorizationRequest> {
    const state = this.secrets.token(STATE_BYTES)
    const codeVerifier = this.secrets.token(VERIFIER_BYTES)

    const query = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: input.redirectUri,
      state,
      response_type: 'code',
      scope: SCOPE,
      code_challenge: this.challengeFor(codeVerifier),
      code_challenge_method: 'S256',
    })

    return Promise.resolve({
      url: `${DIALOG_URL}?${query.toString()}`,
      state,
      // Null, and not an oversight: Meta binds a nonce only in its OIDC
      // variant. Handing one back would tell the caller to check it against an
      // id_token that never arrives, and a check nobody can perform is worse
      // than none, because it reads like one.
      nonce: null,
      codeVerifier,
    })
  }

  /** Three calls, in this order, because each is only trustworthy after the
   * one before it: redeem the code, prove the token is ours, read the profile.
   * `input.nonce` is ignored — see `authorization`. */
  async exchange(input: ExchangeInput): Promise<ExternalUser> {
    if (input.codeVerifier === null) {
      // We always mint a verifier, so a callback without one did not start
      // here. Continuing would silently downgrade the flow to no PKCE.
      failOAuth(this.provider, 'the PKCE verifier was missing from the session')
    }

    const accessToken = await this.redeem(input.code, input.redirectUri, input.codeVerifier)
    await this.assertMintedForThisApp(accessToken)

    return this.readProfile(accessToken)
  }

  /**
   * PKCE challenge: BASE64URL(SHA256(verifier)).
   *
   * `SecretGenerator.sha256` returns hex, because hex is what token storage
   * wants; PKCE compares the raw digest bytes. Passing the hex through builds
   * a challenge that can never match, and only the real provider would say so.
   */
  private challengeFor(verifier: string): string {
    return Buffer.from(this.secrets.sha256(verifier), 'hex').toString('base64url')
  }

  /**
   * POSTed as a form, though Meta documents a GET.
   *
   * A GET puts the app secret and the authorization code in a URL, and URLs
   * are the part of a request that proxies, load balancers and error trackers
   * keep. Meta accepts the same parameters in the body — and does not accept
   * HTTP Basic, so the secret is a field either way and the only choice is
   * where it gets written down.
   */
  private async redeem(code: string, redirectUri: string, codeVerifier: string): Promise<string> {
    const payload = await this.graph.post(
      `${GRAPH_URL}/oauth/access_token`,
      new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
      'token exchange',
    )

    const token = nonEmptyString(payload['access_token'])

    if (token === null) failOAuth(this.provider, 'the token response carried no access token')

    return token
  }

  /**
   * Confirms the access token was minted for THIS app.
   *
   * A Facebook access token is an opaque bearer string that names no audience,
   * and Graph answers `/me` for any valid token whoever issued it. Without
   * this check, anyone holding a token minted for a Meta app they control —
   * and can make any number of people grant — presents it and we sign in as
   * whoever that token belongs to. Account takeover in one request, leaving no
   * trace, because every call succeeds.
   *
   * Redeeming the code with our own secret already makes today's token ours,
   * so this is belt and braces on this path. It stops being belt and braces
   * the moment a token reaches `exchange` from anywhere else — a mobile SDK, a
   * `response_type=token` variant — the change nobody remembers to re-audit.
   */
  private async assertMintedForThisApp(accessToken: string): Promise<void> {
    // The token under inspection has to be a query parameter; `debug_token`
    // has no header form for it. The app access token — `{app-id}|{app-secret}`
    // — does have one, so the secret at least stays out of the URL. Nothing
    // in this file logs a request URL, and nothing should start.
    const query = new URLSearchParams({ input_token: accessToken })
    const payload = await this.graph.get(
      `${GRAPH_URL}/debug_token?${query.toString()}`,
      { Authorization: `Bearer ${this.config.clientId}|${this.config.clientSecret}` },
      'token inspection',
    )

    // `is_valid` must be exactly true — a missing or non-boolean field fails
    // closed. An expired or revoked token still answers 200 here, with
    // `is_valid: false`, so the status code alone decides nothing.
    const data = asJsonObject(payload['data'])

    if (data?.['is_valid'] !== true) {
      failOAuth(this.provider, 'the access token did not inspect as valid')
    }

    if (data['app_id'] !== this.config.clientId) {
      failOAuth(this.provider, 'the access token was issued to another app')
    }
  }

  private async readProfile(accessToken: string): Promise<ExternalUser> {
    const query = new URLSearchParams({
      fields: PROFILE_FIELDS,
      appsecret_proof: this.proofFor(accessToken),
    })
    const payload = await this.graph.get(
      `${GRAPH_URL}/me?${query.toString()}`,
      { Authorization: `Bearer ${accessToken}` },
      'profile lookup',
    )

    const subject = nonEmptyString(payload['id'])

    if (subject === null) failOAuth(this.provider, 'the profile carried no id')

    return {
      provider: this.provider,
      subject,
      email: nonEmptyString(payload['email']),
      /*
       * ALWAYS false. Meta does not assert that this address was verified.
       *
       * Their reference calls it the primary address listed on the profile,
       * omitted when "no valid email address is available" — a deliverability
       * word, not a confirmation word, and the Graph User node exposes no
       * `verified` flag to back the stronger reading. An earlier version of
       * this adapter inferred verification from presence; that inference is
       * the difference between a display value and a credential.
       *
       * `emailVerified: true` is what licenses matching an incoming sign-in to
       * an EXISTING account. Claiming it would let anyone who can list an
       * editor's address on a Facebook profile sign in as that editor and
       * inherit their roles, in one request. Facebook identities are matched
       * on (provider, subject) instead — the only thing Meta vouches for — and
       * the address is carried for display and for creating a NEW account,
       * where there is nobody to impersonate.
       */
      emailVerified: false,
      displayName: nonEmptyString(payload['name']),
    }
  }

  /**
   * appsecret_proof — HMAC-SHA256 of the access token, keyed by the app
   * secret. It proves the call comes from the server holding that secret, so a
   * stolen token alone reads nothing, and Meta rejects calls without it once
   * "Require app secret" is on.
   *
   * `node:crypto` directly: keyed hashing is deterministic, not the ambient
   * randomness the repo bans below the composition root, and `SecretGenerator`
   * has no keyed hash — adding one would push a Meta-specific detail into the
   * application ring. Meta's optional `appsecret_time` is absent on purpose:
   * it needs the wall clock, which this layer does not get.
   */
  private proofFor(accessToken: string): string {
    return createHmac('sha256', this.config.clientSecret).update(accessToken).digest('hex')
  }
}
