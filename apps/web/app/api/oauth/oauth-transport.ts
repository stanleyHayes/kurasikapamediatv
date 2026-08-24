import type { AuthorizationRequest } from '@kurasikapa/application'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl } from '@kurasikapa/web-kit/composition/origins'

/**
 * What the callback has to remember, and how it is carried there.
 *
 * Short-lived httpOnly cookies rather than the URL. `state` is the CSRF token:
 * one an attacker can read from an address bar, a referrer or a server log is
 * not a CSRF token at all. `codeVerifier` is PKCE and must never leave the
 * server; `nonce` binds an OIDC id_token to this browser.
 */

/** Ten minutes. Long enough for a slow consent screen, short enough to be useless later. */
export const OAUTH_COOKIE_MAX_AGE = 600

/**
 * Scoped to the OAuth routes alone, so these never ride along with page views.
 * The callback lives under the same prefix, which is what makes this work.
 */
const PATH = '/api/oauth'

export const STATE_COOKIE = 'kurasikapa_oauth_state'
export const NONCE_COOKIE = 'kurasikapa_oauth_nonce'
export const VERIFIER_COOKIE = 'kurasikapa_oauth_verifier'

/**
 * Absolute, and built from SITE_URL rather than the incoming Host header.
 *
 * The provider compares this against the registered redirect URI, and a value
 * taken from a header an attacker controls is how an authorization code gets
 * delivered somewhere else.
 */
export function redirectUriFor(provider: string): string {
  return `${siteUrl(env())}/api/oauth/${provider}/callback`
}

function cookie(name: string, value: string, secure: boolean, maxAge: number): string {
  const parts = [
    `${name}=${value}`,
    `Path=${PATH}`,
    `Max-Age=${String(maxAge)}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')

  return parts.join('; ')
}

export function oauthCookies(
  _provider: string,
  request: AuthorizationRequest,
  secure: boolean,
): readonly string[] {
  const specs = [cookie(STATE_COOKIE, request.state, secure, OAUTH_COOKIE_MAX_AGE)]

  // Empty string, not omitted, when a provider has no nonce or verifier: the
  // callback must be able to tell "this provider does not use one" from "the
  // cookie was dropped", and an absent cookie cannot say which.
  specs.push(cookie(NONCE_COOKIE, request.nonce ?? '', secure, OAUTH_COOKIE_MAX_AGE))
  specs.push(cookie(VERIFIER_COOKIE, request.codeVerifier ?? '', secure, OAUTH_COOKIE_MAX_AGE))

  return specs
}

/** The same three, expired — cleared the moment the callback has read them. */
export function clearedOauthCookies(secure: boolean): readonly string[] {
  return [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE].map((name) =>
    cookie(name, '', secure, 0),
  )
}
