import { OAuthExchangeFailed, OAuthStateMismatch } from '@kurasikapa/application'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl, studioUrl } from '@kurasikapa/web-kit/composition/origins'
import { issuedCookies, withCookies } from '@kurasikapa/web-kit/composition/session-transport'
import {
  NONCE_COOKIE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  clearedOauthCookies,
  redirectUriFor,
} from '../../oauth-transport'

/**
 * The provider's return leg.
 *
 * Everything goes through `authGraph().completeOAuthSignIn`, which compares the
 * `state` the provider echoed against the one we set before doing anything
 * else. Calling `provider.exchange()` from here instead would be login CSRF:
 * an attacker completes an authorization with THEIR account, lures a reader
 * into visiting the callback, and the reader's browser silently links the
 * attacker's identity to the reader's session.
 */

const secure = (): boolean => env().NODE_ENV === 'production'

/** Google and Facebook redirect back with a query string. */
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const url = new URL(request.url)

  return complete(request, context, {
    code: url.searchParams.get('code') ?? '',
    presentedState: url.searchParams.get('state') ?? '',
    error: url.searchParams.get('error'),
  })
}

/**
 * Apple posts the callback as a form (`response_mode=form_post`) rather than
 * redirecting, so the same handler has to accept a body.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const form = await request.formData()
  const text = (name: string): string => {
    const value = form.get(name)

    return typeof value === 'string' ? value : ''
  }

  return complete(request, context, {
    code: text('code'),
    presentedState: text('state'),
    error: text('error') === '' ? null : text('error'),
  })
}

interface Returned {
  readonly code: string
  readonly presentedState: string
  readonly error: string | null
}

async function complete(
  request: Request,
  context: { params: Promise<{ provider: string }> },
  returned: Returned,
): Promise<Response> {
  const { provider: name } = await context.params
  const provider = authGraph().providers.get(name as never)

  if (provider === undefined) return new Response('Not found', { status: 404 })

  // The reader declined consent, or the provider refused. Not an error page —
  // they chose this, and the sign-in form is where they want to be.
  if (returned.error !== null) return failed(name)

  const jar = cookieMap(request.headers.get('cookie'))

  try {
    const tokens = await authGraph().completeOAuthSignIn.execute({
      provider,
      redirectUri: redirectUriFor(name),
      code: returned.code,
      presentedState: returned.presentedState,
      // '' when the cookie is missing or expired, which the use case treats as
      // a mismatch rather than a match against an equally empty presented value.
      expectedState: jar.get(STATE_COOKIE) ?? '',
      nonce: emptyToNull(jar.get(NONCE_COOKIE)),
      codeVerifier: emptyToNull(jar.get(VERIFIER_COOKIE)),
    })

    return landing(`${studioUrl(env())}`, issuedCookies(tokens))
  } catch (error) {
    if (error instanceof OAuthStateMismatch || error instanceof OAuthExchangeFailed) {
      return failed(name)
    }

    throw error
  }
}

/**
 * A successful sign-in lands in the studio, exactly as the password form does.
 * Someone with no editorial role is bounced to the site by the studio's own
 * guard — that decision belongs to the guard, which reads roles per request,
 * not to a callback that would have to duplicate it.
 */
function landing(destination: string, session: readonly ReturnType<typeof issuedCookies>[number][]): Response {
  const response = withCookies(
    new Response(null, { status: 302, headers: { Location: destination } }),
    session,
  )

  for (const value of clearedOauthCookies(secure())) {
    response.headers.append('Set-Cookie', value)
  }

  return response
}

/** Back to sign-in with a flag the page can render. Never with a reason. */
function failed(provider: string): Response {
  const response = new Response(null, {
    status: 302,
    headers: { Location: `${siteUrl(env())}/en/sign-in?provider=${provider}&failed=1` },
  })

  for (const value of clearedOauthCookies(secure())) {
    response.headers.append('Set-Cookie', value)
  }

  return response
}

const emptyToNull = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value

function cookieMap(header: string | null): Map<string, string> {
  const jar = new Map<string, string>()
  if (header === null) return jar

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index === -1) continue
    jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim())
  }

  return jar
}
