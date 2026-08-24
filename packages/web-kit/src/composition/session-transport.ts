import type { SessionTokens } from '@kurasikapa/application'
import { env } from './env'
import { clearedSessionCookies, sessionCookies, type CookieSpec } from './session-cookies'

/**
 * How a session reaches the browser, decided in one place.
 *
 * `secure` MUST agree with what `actor.ts` reads — the cookie name itself
 * changes with it (`__Secure-` prefix), so a mismatch is not a weaker session
 * but an invisible one: set under one name, looked up under another, and
 * everybody is anonymous. That failure is exactly what KUR-66 shipped, in a
 * larger form, and it is why this derivation lives beside the reader rather
 * than in each route.
 */

/**
 * Where the refresh cookie is scoped, and therefore where the refresh route
 * must live. Changing one without the other silently ends every session at the
 * fifteen-minute access-token expiry, with no error anywhere.
 *
 * On the SITE, always — the studio's `basePath` prefixes its own routes, so it
 * cannot serve this path. The studio refreshes by calling the site's endpoint
 * cross-origin with credentials; the two are same-site under COOKIE_DOMAIN, so
 * `sameSite: 'lax'` allows it. See `refresh/route.ts`.
 */
export const REFRESH_PATH = '/api/session/refresh'

function options(): Parameters<typeof sessionCookies>[1] {
  return {
    secure: env().NODE_ENV === 'production',
    domain: env().COOKIE_DOMAIN,
    refreshPath: REFRESH_PATH,
  }
}

/** The two cookies for a freshly issued session. */
export function issuedCookies(tokens: SessionTokens): readonly CookieSpec[] {
  return sessionCookies(tokens, options())
}

/** The same two, emptied — name, path and domain matched so they actually clear. */
export function clearedCookies(): readonly CookieSpec[] {
  return clearedSessionCookies(options())
}

/**
 * Applies cookie specs to a Response.
 *
 * `headers.append`, never `set`: two Set-Cookie headers are required and `set`
 * would leave the browser holding only the refresh cookie — a session that
 * cannot be read but can be renewed forever.
 */
export function withCookies(response: Response, specs: readonly CookieSpec[]): Response {
  for (const spec of specs) {
    response.headers.append('Set-Cookie', serialise(spec))
  }

  return response
}

function serialise(spec: CookieSpec): string {
  const parts = [
    `${spec.name}=${spec.value}`,
    `Path=${spec.path}`,
    `Max-Age=${String(spec.maxAge)}`,
    `SameSite=Lax`,
    'HttpOnly',
  ]

  if (spec.secure) parts.push('Secure')
  if (spec.domain !== undefined) parts.push(`Domain=${spec.domain}`)

  return parts.join('; ')
}
