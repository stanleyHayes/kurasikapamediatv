import { createHmac } from 'node:crypto'
import {
  OAuthExchangeFailed,
  type AuthorizationRequest,
  type ExternalUser,
  type OAuthProvider,
  type SecretGenerator,
} from '@kurasikapa/application'

/**
 * Facebook Login — the classic authorization-code flow.
 *
 * Meta also documents an OIDC variant (`scope=openid` plus a mandatory
 * `nonce`) whose token response carries an id_token we could verify against
 * Meta's JWKS. This adapter stays on the classic flow, which returns an opaque
 * bearer token and nothing that names an audience. The guarantee an id_token
 * would have carried is recovered by `assertMintedForThisApp`; that call is
 * the security of this file, not a nicety.
 */

/**
 * Pinned on purpose. An unversioned Graph URL floats to whatever Meta ships
 * next, so a breaking change would land on us with no deploy of ours and on
 * Meta's calendar. Versions expire roughly two years after release — v26.0
 * shipped 29 July 2026 — which makes this constant a dated commitment that
 * somebody has to renew, not a set-and-forget.
 */
const GRAPH_VERSION = 'v26.0'

const DIALOG_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`

/**
 * `public_profile` is granted by default and covers id and name. `email` is a
 * separate permission: it needs App Review, and the person can still decline
 * it on the consent screen — which is why `exchange` treats a missing address
 * as normal rather than as a failure.
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
}

interface ExchangeInput {
  readonly code: string
  readonly redirectUri: string
  readonly nonce: string | null
  readonly codeVerifier: string | null
}

export class FacebookOAuthProvider implements OAuthProvider {
  readonly provider = 'facebook' as const

  constructor(
    private readonly config: FacebookOAuthConfig,
    private readonly secrets: SecretGenerator,
  ) {}

  /**
   * Not `async`: there is nothing to await, and a needless promise here would
   * be one more thing for the caller to get wrong ordering around.
   */
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
      // than no check, because it reads like one.
      nonce: null,
      codeVerifier,
    })
  }

  /**
   * Three calls, in this order, because each one is only trustworthy after the
   * one before it: redeem the code, prove the token is ours, then read the
   * profile. `input.nonce` is ignored — see `authorization`.
   */
  async exchange(input: ExchangeInput): Promise<ExternalUser> {
    if (input.codeVerifier === null) {
      // We always mint a verifier, so a callback without one did not start
      // here. Continuing would silently downgrade the flow to no PKCE.
      throw new OAuthExchangeFailed(this.provider, 'the PKCE verifier was missing from the session')
    }

    const accessToken = await this.redeem(input.code, input.redirectUri, input.codeVerifier)
    await this.assertMintedForThisApp(accessToken)

    return this.readProfile(accessToken)
  }

  /**
   * PKCE challenge: BASE64URL(SHA256(verifier)).
   *
   * `SecretGenerator.sha256` returns hex, because hex is what token storage
   * wants; PKCE compares the raw digest bytes. Passing the hex string straight
   * through would build a challenge that can never match, and the failure
   * would only show up against the real provider, never in a test with a fake.
   */
  private challengeFor(verifier: string): string {
    return Buffer.from(this.secrets.sha256(verifier), 'hex').toString('base64url')
  }

  /**
   * POSTed as a form, though Meta documents a GET.
   *
   * A GET puts the app secret and the authorization code in a URL, and URLs
   * are the part of a request that proxies, load balancers and error trackers
   * keep. Meta accepts the same parameters in the body. (It does not accept
   * HTTP Basic client authentication, so the secret travels as a field either
   * way — the choice is only about where it gets written down.)
   */
  private async redeem(code: string, redirectUri: string, codeVerifier: string): Promise<string> {
    const response = await fetch(`${GRAPH_URL}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
    })

    const payload = await this.read(response, 'token exchange')
    const token = readString(payload['access_token'])

    if (token === null) {
      throw new OAuthExchangeFailed(this.provider, 'the token response carried no access token')
    }

    return token
  }

  /**
   * Confirms the access token was minted for THIS app.
   *
   * A Facebook access token is an opaque bearer string that says nothing about
   * its audience, and Graph will answer `/me` for any valid token whoever
   * issued it. Without this check, anyone holding a token minted for a
   * different Meta app — their own app, which they control and can make any
   * number of people grant — can present it to us and we will sign in as
   * whoever that token belongs to. That is account takeover in one request,
   * and it leaves no trace: every call succeeds.
   *
   * Redeeming the code with our own secret already makes today's token ours,
   * so this is belt and braces on this path. It stops being belt and braces
   * the moment a token reaches `exchange` from anywhere else — a mobile SDK,
   * a `response_type=token` variant — and that is exactly the change nobody
   * remembers to re-audit.
   */
  private async assertMintedForThisApp(accessToken: string): Promise<void> {
    // The token under inspection has to be a query parameter; `debug_token`
    // has no header form for it. The app access token — `{app-id}|{app-secret}`
    // — does have one, so the secret at least stays out of the URL. Nothing
    // in this file logs a request URL, and nothing should start.
    const query = new URLSearchParams({ input_token: accessToken })
    const response = await fetch(`${GRAPH_URL}/debug_token?${query.toString()}`, {
      headers: { Authorization: `Bearer ${this.config.clientId}|${this.config.clientSecret}` },
    })

    const payload = await this.read(response, 'token inspection')
    const data = asObject(payload['data'])

    // `is_valid` must be exactly true — a missing or non-boolean field fails
    // closed. An expired or revoked token still answers 200 here, with
    // `is_valid: false`, so the status code alone decides nothing.
    if (data?.['is_valid'] !== true) {
      throw new OAuthExchangeFailed(this.provider, 'the access token did not inspect as valid')
    }

    if (data['app_id'] !== this.config.clientId) {
      throw new OAuthExchangeFailed(this.provider, 'the access token was issued to another app')
    }
  }

  private async readProfile(accessToken: string): Promise<ExternalUser> {
    const query = new URLSearchParams({
      fields: PROFILE_FIELDS,
      appsecret_proof: this.proofFor(accessToken),
    })
    const response = await fetch(`${GRAPH_URL}/me?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const payload = await this.read(response, 'profile lookup')
    const subject = readString(payload['id'])

    if (subject === null) {
      throw new OAuthExchangeFailed(this.provider, 'the profile carried no id')
    }

    const email = readString(payload['email'])

    return {
      provider: this.provider,
      subject,
      email,
      /*
       * ALWAYS false. Meta does not assert that this address was verified.
       *
       * Their reference says only that `email` is "the User's primary email
       * address listed on their profile" and is omitted when "no valid email
       * address is available". "Valid" is a formatting and deliverability
       * word, not a confirmation word, and the Graph User node exposes no
       * `verified` flag to back the stronger reading. An earlier version of
       * this adapter inferred verification from presence; that inference is
       * the difference between a display value and a credential.
       *
       * It matters because `emailVerified: true` is what licenses matching an
       * incoming sign-in to an EXISTING account. Claiming it here would let
       * anyone who can list an editor's address on a Facebook profile sign in
       * as that editor and inherit their roles, in one request.
       *
       * Facebook identities are therefore matched on (provider, subject) —
       * the only thing Meta actually vouches for — and the address is carried
       * for display and for creating a NEW account, where there is nobody to
       * impersonate.
       */
      emailVerified: false,
      displayName: readString(payload['name']),
    }
  }

  /**
   * appsecret_proof — HMAC-SHA256 of the access token, keyed by the app
   * secret. It proves the call comes from the server holding the secret, so a
   * stolen token on its own reads nothing, and Meta rejects calls without it
   * once "Require app secret" is on.
   *
   * `node:crypto` directly, because keyed hashing is deterministic and is not
   * the ambient randomness the repo bans below the composition root;
   * `SecretGenerator` has no keyed hash and adding one would push a
   * Meta-specific detail into the application ring. Meta's optional
   * `appsecret_time` is deliberately absent: it needs the wall clock, which
   * this layer does not get, and the proof is complete without it.
   */
  private proofFor(accessToken: string): string {
    return createHmac('sha256', this.config.clientSecret).update(accessToken).digest('hex')
  }

  /**
   * Every Graph response, funnelled through one reader.
   *
   * `stage` names which of the three calls failed, since all three fail the
   * same way from the caller's side. Graph's own `error.message` is carried
   * through because it is the only clue an operator gets; it never contains
   * the token, and nothing here echoes the code, the token or the secret.
   */
  private async read(response: Response, stage: string): Promise<Record<string, unknown>> {
    const parsed: unknown = await response.json().catch(() => null)
    const body = asObject(parsed)

    if (body === null) {
      throw new OAuthExchangeFailed(this.provider, `${stage} returned a body that was not JSON`)
    }

    if (!response.ok) {
      const reason = graphMessage(body, response)
      throw new OAuthExchangeFailed(this.provider, `${stage} failed: ${reason}`)
    }

    return body
  }
}

function graphMessage(body: Record<string, unknown>, response: Response): string {
  const error = asObject(body['error'])

  return (error === null ? null : readString(error['message'])) ?? `HTTP ${String(response.status)}`
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** Narrows an unknown JSON field, treating `''` as absent — Graph omits a
 * field it has no value for, but an empty display name is not a name. */
function readString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}
