import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { socialProviders } from './auth-providers'
import { env } from './env'
import { mongoDb } from './mongo'

/**
 * Authentication only. See ADR-0004.
 *
 * Better Auth owns `user`, `session`, `account` and `verification`. It has no
 * idea what a Journalist may do — that lives in `packages/domain/identity` and
 * is read through `RoleRepository` on every request.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- see AuthInstance below: annotating this widens the generic and breaks assignability.
function build() {
  return betterAuth({
    database: mongodbAdapter(mongoDb()),
    secret: env().BETTER_AUTH_SECRET,
    baseURL: env().APP_URL,

    emailAndPassword: { enabled: true },
    socialProviders: socialProviders(process.env),

    session: {
      // Roles are never carried in the session; they are read per request so a
      // revocation lands immediately. The session only says who someone is.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },

    advanced: {
      cookiePrefix: 'kurasikapa',
      useSecureCookies: env().NODE_ENV === 'production',
    },

    // Lets Server Actions set the session cookie.
    plugins: [nextCookies()],
  })
}

/**
 * Inferred, not annotated. `betterAuth` returns `Auth<TOptions>` narrowed to
 * the exact literal it was given; writing `ReturnType<typeof betterAuth>`
 * widens it to `Auth<BetterAuthOptions>` and the two are not assignable.
 */
type AuthInstance = ReturnType<typeof build>

let instance: AuthInstance | undefined

export function auth(): AuthInstance {
  instance ??= build()
  return instance
}

/** Test seam. */
export function resetAuth(): void {
  instance = undefined
}
