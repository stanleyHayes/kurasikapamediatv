import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/composition/auth'

/**
 * Better Auth's own endpoints. This is the one route that talks to the auth
 * library directly; everything else in the app receives an Actor.
 *
 * Credential rate limiting is NOT wrapped around this handler. Better Auth
 * does it itself and fires first — a wrapper of ours was tested and never
 * reached, because its limiter refused at three attempts before ours at six.
 * A second limiter that always loses the race is dead code shaped like a
 * control, and the next person to read it would believe it was doing something.
 *
 * What that testing did find is that its default storage is in-memory, which
 * on serverless is per-instance and therefore not a limit at all. It is
 * configured for database storage in composition/auth.ts.
 */
export const { GET, POST } = toNextJsHandler(auth())
