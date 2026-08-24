import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { env } from '@kurasikapa/web-kit/composition/env'
import { oauthCookies, redirectUriFor } from '../oauth-transport'

/**
 * Starts the round trip to a provider.
 *
 * The three secrets the callback needs — `state`, `nonce`, `codeVerifier` —
 * are minted by the adapter and stashed in short-lived httpOnly cookies. They
 * must not travel in the URL: a CSRF token readable from an address bar, a
 * referrer header or a proxy log is not a CSRF token.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: name } = await context.params
  const provider = authGraph().providers.get(name as never)

  // Unconfigured is a 404, not a 500. A provider without credentials is one we
  // never advertised, and saying more tells a prober which are wired up.
  if (provider === undefined) return new Response('Not found', { status: 404 })

  const authorization = await provider.authorization({ redirectUri: redirectUriFor(name) })

  // Built by hand rather than `Response.redirect`, whose headers are immutable
  // — appending Set-Cookie to one throws, and the round trip would start with
  // no state to compare on return.
  const response = new Response(null, {
    status: 302,
    headers: { Location: authorization.url },
  })

  for (const value of oauthCookies(name, authorization, env().NODE_ENV === 'production')) {
    response.headers.append('Set-Cookie', value)
  }

  return response
}
