'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@kurasikapa/web-kit/composition/auth'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl } from '@kurasikapa/web-kit/composition/origins'
import { externalRoute } from '../external-route'

/**
 * Signing out of the studio.
 *
 * A server action rather than the browser auth client, because the studio
 * mounts no `/api/auth` routes of its own. It does not need to: Better Auth
 * validates a session server-side straight from the cookie and the shared
 * Mongo, which is all `currentActor()` ever asked of it. The sign-IN flow —
 * providers, 2FA, captcha, rate limiting — stays on the public site, where it
 * was already built and tested.
 *
 * That keeps exactly one auth surface exposed to the internet across the two
 * deployments, instead of two that must be kept identical.
 */
export async function signOutAction(): Promise<void> {
  // `nextCookies()` is last in the plugin chain, so this clears the cookie on
  // the response the action is producing.
  await auth().api.signOut({ headers: await headers() })

  // Out of the studio entirely: an editor who signed out has nothing left to
  // look at here, and every studio route would just bounce them anyway.
  redirect(externalRoute(siteUrl(env())))
}
