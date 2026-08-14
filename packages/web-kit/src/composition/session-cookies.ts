import type { SessionTokens } from '@kurasikapa/application'

/**
 * The two cookies a session lives in, and the flags that make them safe.
 *
 * Two rather than one, with different paths, because they have different
 * exposure. The access token is sent on every request to every route; the
 * refresh token is sent ONLY to the refresh endpoint. A refresh token that
 * accompanied every page view would be exposed on every page view, and it is
 * the credential worth thirty days.
 */
export interface SessionCookieOptions {
  readonly secure: boolean
  /** Parent domain for split-origin deployment. Undefined keeps it host-only. */
  readonly domain: string | undefined
  /** Where the refresh cookie is scoped. Must match the refresh route. */
  readonly refreshPath: string
}

export interface CookieSpec {
  readonly name: string
  readonly value: string
  readonly httpOnly: true
  readonly secure: boolean
  readonly sameSite: 'lax'
  readonly path: string
  readonly maxAge: number
  readonly domain?: string
}

/**
 * `__Secure-` in production, plain over http.
 *
 * The prefix is enforced by the browser: a cookie named `__Secure-*` is
 * refused unless it is `Secure`, which stops a plaintext subdomain from
 * overwriting the session. `__Host-` would be stronger still — it also forbids
 * a `Domain` attribute — but the split-origin deployment NEEDS `Domain` so the
 * studio subdomain can see the session (ADR-0011), and the two are mutually
 * exclusive. `__Secure-` is the strongest prefix compatible with that.
 *
 * The name necessarily differs between http and https. That is a footgun, so
 * it is derived here, once, and nowhere else.
 */
export function accessCookieName(secure: boolean): string {
  return secure ? '__Secure-kurasikapa_session' : 'kurasikapa_session'
}

export function refreshCookieName(secure: boolean): string {
  return secure ? '__Secure-kurasikapa_refresh' : 'kurasikapa_refresh'
}

/**
 * `sameSite: 'lax'`, not `strict`.
 *
 * Strict would drop the session cookie on any cross-site navigation INTO the
 * site — following a link from Google, from a newsletter, from a social post.
 * A reader clicking through to an article would arrive signed out, on a news
 * site whose traffic is overwhelmingly inbound links. Lax still withholds the
 * cookie from cross-site POSTs, which is the CSRF case that matters.
 */
export function sessionCookies(
  tokens: SessionTokens,
  options: SessionCookieOptions,
): readonly CookieSpec[] {
  const shared = {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    ...(options.domain === undefined ? {} : { domain: options.domain }),
  } as const

  return [
    {
      ...shared,
      name: accessCookieName(options.secure),
      value: tokens.accessToken,
      path: '/',
      maxAge: tokens.accessExpiresInSeconds,
    },
    {
      ...shared,
      name: refreshCookieName(options.secure),
      value: tokens.refreshToken,
      // Scoped to the refresh endpoint alone. This is the point of two cookies.
      path: options.refreshPath,
      maxAge: tokens.refreshExpiresInSeconds,
    },
  ]
}

/**
 * The same two cookies, emptied and expired.
 *
 * Name, path and domain must match what was set or the browser writes a second
 * cookie beside the first and the session survives the sign-out — the classic
 * "signed out but still signed in" bug.
 */
export function clearedSessionCookies(options: SessionCookieOptions): readonly CookieSpec[] {
  return sessionCookies(
    {
      accessToken: '',
      refreshToken: '',
      sessionId: '',
      accessExpiresInSeconds: 0,
      refreshExpiresInSeconds: 0,
    },
    options,
  )
}
