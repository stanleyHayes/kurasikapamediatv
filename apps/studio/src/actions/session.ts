'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl } from '@kurasikapa/web-kit/composition/origins'
import { accessCookieName } from '@kurasikapa/web-kit/composition/session-cookies'
import { externalRoute } from '../external-route'

/**
 * Signing out of the studio.
 *
 * A server action rather than a call to the site's `DELETE /api/session`,
 * because the refresh cookie is path-scoped to that route on the SITE and the
 * studio can neither read nor clear it — its `basePath` prefixes everything it
 * serves. So the two halves are done separately: the session FAMILY is revoked
 * here through the shared store, which is what actually ends the session, and
 * the access cookie is cleared so this browser stops presenting one.
 *
 * `allSessions`, deliberately. Without the refresh token there is no way to
 * name the single family being surrendered, and for a newsroom CMS "sign me
 * out" meaning "everywhere" is the safer reading of the same click.
 */
export async function signOutAction(): Promise<void> {
  const actor = await currentActor()

  if (actor !== null) {
    await authGraph().signOut.execute({
      refreshToken: null,
      allSessions: true,
      userId: actor.id,
    })
  }

  // Cleared even when there was no actor: a browser holding an unreadable or
  // expired cookie should still leave without one.
  const secure = env().NODE_ENV === 'production'
  const jar = await cookies()

  jar.set({
    name: accessCookieName(secure),
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(env().COOKIE_DOMAIN === undefined ? {} : { domain: env().COOKIE_DOMAIN }),
  })

  // Out of the studio entirely: an editor who signed out has nothing left to
  // look at here, and every studio route would just bounce them anyway.
  redirect(externalRoute(siteUrl(env())))
}
