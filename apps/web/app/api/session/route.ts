import { startPasswordSession } from '@kurasikapa/web-kit/bff/password-session-http'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { refreshCookieName } from '@kurasikapa/web-kit/composition/session-cookies'
import {
  clearedCookies,
  withCookies,
} from '@kurasikapa/web-kit/composition/session-transport'
import { env } from '@kurasikapa/web-kit/composition/env'
import { cookies } from 'next/headers'

const json = (body: unknown, status: number): Response => Response.json(body, { status })

/**
 * The session itself: POST to start one, DELETE to end it.
 *
 * This is the write half of what `composition/actor.ts` reads. KUR-66 landed
 * the read without it, so the access cookie was never issued and every request
 * — reader, editor, Server Action — resolved as anonymous while sign-in
 * appeared to succeed. Nothing else in the app sets a session cookie.
 */

export async function POST(request: Request): Promise<Response> {
  return startPasswordSession(request)
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
