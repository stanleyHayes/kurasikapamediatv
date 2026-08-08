import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/composition/auth'

/**
 * Better Auth's own endpoints. This is the one route that talks to the auth
 * library directly; everything else in the app receives an Actor.
 */
export const { GET, POST } = toNextJsHandler(auth())
