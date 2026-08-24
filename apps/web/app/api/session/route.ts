import { SignInFailed, TooManyAttempts } from '@kurasikapa/application'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { refreshCookieName } from '@kurasikapa/web-kit/composition/session-cookies'
import {
  clearedCookies,
  issuedCookies,
  withCookies,
} from '@kurasikapa/web-kit/composition/session-transport'
import { env } from '@kurasikapa/web-kit/composition/env'
import { callerKey } from '@kurasikapa/web-kit/security/rate-limit'
import { cookies } from 'next/headers'

/**
 * The session itself: POST to start one, DELETE to end it.
 *
 * This is the write half of what `composition/actor.ts` reads. KUR-66 landed
 * the read without it, so the access cookie was never issued and every request
 * — reader, editor, Server Action — resolved as anonymous while sign-in
 * appeared to succeed. Nothing else in the app sets a session cookie.
 */

interface Body {
  readonly email?: unknown
  readonly password?: unknown
}

const json = (body: unknown, status: number): Response =>
  Response.json(body, { status })

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export async function POST(request: Request): Promise<Response> {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ message: 'Expected a JSON body.' }, 400)
  }

  try {
    const outcome = await authGraph().signIn.execute({
      email: str(body.email),
      password: str(body.password),
      callerKey: await callerKey(null),
    })

    // A challenge is NOT a session. It goes back in the body, never in a
    // cookie: a second factor that rides along with every request is a second
    // factor the browser can be tricked into presenting.
    if (outcome.kind === 'second-factor-required') {
      return json({ secondFactor: true, challengeToken: outcome.challengeToken }, 200)
    }

    return withCookies(json({ secondFactor: false }, 200), issuedCookies(outcome.tokens))
  } catch (error) {
    if (error instanceof TooManyAttempts) {
      return json({ message: error.message }, 429)
    }
    if (error instanceof SignInFailed) {
      // The use case already collapses unknown-email, wrong-password and
      // provider-only into one message. Do not enrich it here.
      return json({ message: error.message }, 401)
    }

    throw error
  }
}

/**
 * Ends the session, and says so even when there was nothing to end.
 *
 * The cookies are cleared unconditionally. A sign-out that clears them only on
 * a successful revoke leaves a browser holding a live access token whenever the
 * store is briefly unavailable — signed out everywhere except the one place it
 * matters.
 */
export async function DELETE(): Promise<Response> {
  const jar = await cookies()
  const token = jar.get(refreshCookieName(env().NODE_ENV === 'production'))?.value ?? null

  await authGraph().signOut.execute({ refreshToken: token === '' ? null : token })

  return withCookies(json({ signedOut: true }, 200), clearedCookies())
}
