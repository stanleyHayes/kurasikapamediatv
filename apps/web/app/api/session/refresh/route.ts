import { SessionNotRefreshable } from '@kurasikapa/application'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { env } from '@kurasikapa/web-kit/composition/env'
import { refreshCookieName } from '@kurasikapa/web-kit/composition/session-cookies'
import {
  clearedCookies,
  issuedCookies,
  withCookies,
} from '@kurasikapa/web-kit/composition/session-transport'
import { studioUrl } from '@kurasikapa/web-kit/composition/origins'

/**
 * Renews a session, and is the only path the refresh cookie is sent to.
 *
 * Lives on the SITE, at the exact path `session-transport.ts` scopes the
 * cookie to. The studio cannot serve this path — its `basePath` prefixes
 * everything it owns — so it calls here cross-origin with credentials. That
 * works because the two deployments are same-SITE under COOKIE_DOMAIN, which
 * `sameSite: 'lax'` permits; without the CORS headers below the browser would
 * make the request and then refuse to let the studio read the result.
 *
 * Access tokens last fifteen minutes. Without this route an editor is returned
 * to sign-in four times an hour, which is how a working session becomes a
 * support ticket.
 */

function corsHeaders(origin: string | null): Record<string, string> {
  // Echoed, never `*`: a wildcard is invalid with credentials, and the browser
  // drops the response rather than telling anyone why.
  const studio = new URL(studioUrl(env())).origin

  return origin === studio
    ? {
        'Access-Control-Allow-Origin': studio,
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' }
}

export function OPTIONS(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get('origin')),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request: Request): Promise<Response> {
  const cors = corsHeaders(request.headers.get('origin'))
  const secure = env().NODE_ENV === 'production'

  // Read from the request rather than `cookies()`, so a cross-origin call from
  // the studio is served by the same code path as a same-origin one.
  const presented = cookieFrom(request.headers.get('cookie'), refreshCookieName(secure))

  if (presented === null) {
    return withCookies(
      Response.json({ message: 'No session to refresh.' }, { status: 401, headers: cors }),
      clearedCookies(),
    )
  }

  try {
    const tokens = await authGraph().refresh.execute({ refreshToken: presented })

    return withCookies(
      Response.json({ refreshed: true }, { status: 200, headers: cors }),
      issuedCookies(tokens),
    )
  } catch (error) {
    if (error instanceof SessionNotRefreshable) {
      // Clear on the way out. A browser that keeps a dead refresh cookie
      // retries forever, and on a REUSED token that retry is the attacker's
      // too — the family is already revoked, so the only useful thing left is
      // to stop this browser asking.
      return withCookies(
        Response.json({ message: error.message }, { status: 401, headers: cors }),
        clearedCookies(),
      )
    }

    throw error
  }
}

/**
 * Parsed by hand rather than through `cookies()`, which reads the ambient
 * request and would ignore the header a cross-origin caller actually sent.
 */
function cookieFrom(header: string | null, name: string): string | null {
  if (header === null) return null

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index === -1) continue
    if (pair.slice(0, index).trim() !== name) continue

    const value = pair.slice(index + 1).trim()

    return value === '' ? null : value
  }

  return null
}
