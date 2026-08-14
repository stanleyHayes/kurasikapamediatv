import { assertUsable, type Actor } from '@kurasikapa/domain'
import { cookies } from 'next/headers'
import { systemClock } from './ambient'
import { authGraph } from './auth-graph'
import { container } from './container'
import { env } from './env'
import { accessCookieName } from './session-cookies'

/**
 * The bridge between authentication and authorisation.
 *
 * Every mutating Server Action calls this and hands the result to a use case.
 * A role check in a component is cosmetic; this is the control.
 *
 * Since KUR-66 the identity comes from our own session JWT rather than a
 * library's session lookup. The shape of this function is deliberately
 * unchanged — it still answers "who is this, and what may they do?" — because
 * every caller in both apps depends on it and none of them should care which
 * library, if any, verifies the cookie.
 *
 * Note what is NOT here: a database read for the session. An access token is
 * verified by signature alone, which is what keeps this cheap enough to call
 * on every request. Its fifteen-minute life is the containment; the revocable
 * half is the refresh token, which is stored.
 */
export async function currentActor(): Promise<Actor | null> {
  const userId = await signedInUserId()

  // Roles are read here, per request, NOT carried in the token — so a
  // revocation lands on the next request instead of whenever a token happens
  // to expire. This is the rule the whole permission model rests on.
  return container().resolveActor.execute({ userId })
}

async function signedInUserId(): Promise<Actor['id'] | null> {
  const jar = await cookies()
  const token = jar.get(accessCookieName(env().NODE_ENV === 'production'))?.value

  if (token === undefined || token === '') return null

  try {
    const claims = await authGraph().tokens.verify(token)

    // The kind check matters as much as the signature. A challenge token is
    // signed with the same key, and accepting one here would mean knowing a
    // password is enough to be signed in — the second factor bypassed entirely.
    assertUsable(claims, 'access', systemClock.now())

    return claims.sub
  } catch {
    // An expired, forged or malformed cookie is an anonymous visitor, not an
    // error. Throwing here would turn a stale tab into a 500 on every page.
    return null
  }
}

export class NotSignedIn extends Error {
  constructor() {
    super('This action requires a signed-in user')
    this.name = 'NotSignedIn'
  }
}

/**
 * For Server Actions that cannot proceed anonymously. Throws rather than
 * returning null, so a caller cannot forget the check and pass `null` onward.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor()
  if (actor === null) throw new NotSignedIn()

  return actor
}
