import type { ExternalProvider } from '@kurasikapa/domain'

/**
 * One external sign-in provider, reduced to the two questions we actually ask.
 *
 * Every provider differs in ways that do not matter here — Apple posts its
 * callback instead of redirecting, Facebook may omit the email entirely,
 * Google returns an OIDC id_token — and the adapters absorb all of it. What
 * comes back is a verified subject and, sometimes, a verified email.
 */

/** What the caller must remember between the redirect out and the callback. */
export interface AuthorizationRequest {
  readonly url: string
  /** CSRF token. Echoed by the provider and compared on return. */
  readonly state: string
  /**
   * Binds the id_token to this browser. Only meaningful for OIDC providers;
   * null where the provider does not support it.
   */
  readonly nonce: string | null
  /**
   * PKCE verifier. Held server-side and sent at token exchange, so an
   * intercepted authorization code cannot be redeemed by anyone else.
   */
  readonly codeVerifier: string | null
}

/**
 * A verified identity.
 *
 * `email` is nullable and `emailVerified` is not a formality:
 *
 * - Facebook omits the email when the person declined the permission, or when
 *   their account has no confirmed address.
 * - Apple returns a private relay address that forwards, and may stop.
 *
 * An UNVERIFIED email must never be used to match an existing account. That is
 * account takeover in one step: register a provider account claiming an
 * editor's address, sign in, inherit their roles.
 */
export interface ExternalUser {
  readonly provider: ExternalProvider
  readonly subject: string
  readonly email: string | null
  readonly emailVerified: boolean
  readonly displayName: string | null
}

export class OAuthExchangeFailed extends Error {
  constructor(
    readonly provider: ExternalProvider,
    reason: string,
  ) {
    super(`${provider} sign-in failed: ${reason}`)
    this.name = 'OAuthExchangeFailed'
  }
}

export class OAuthStateMismatch extends Error {
  constructor() {
    super('This sign-in link is no longer valid. Please try again.')
    this.name = 'OAuthStateMismatch'
  }
}

export interface OAuthProvider {
  readonly provider: ExternalProvider

  /** Builds the URL to send the browser to, plus the secrets to remember. */
  authorization(input: { readonly redirectUri: string }): Promise<AuthorizationRequest>

  /**
   * Trades the authorization code for a verified identity.
   *
   * The adapter is responsible for verifying whatever the provider returns —
   * id_token signature against the provider's JWKS, issuer, audience and
   * nonce. Returning an unverified claim from here would make every caller
   * responsible for a check none of them would remember to do.
   */
  exchange(input: {
    readonly code: string
    readonly redirectUri: string
    readonly nonce: string | null
    readonly codeVerifier: string | null
  }): Promise<ExternalUser>
}
