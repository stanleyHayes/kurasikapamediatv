import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { betterAuth } from 'better-auth'
import { authPlugins } from './auth-plugins'
import { socialProviders } from './auth-providers'
import { env } from './env'
import { mongoDb } from './mongo'
import { cookieScope, trustedOrigins } from './origins'

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

    /*
     * Better Auth rate-limits credential endpoints itself, and it is on by
     * default in production — discovered by testing, not by reading: a burst
     * of sign-in attempts was refused at three, before our own limiter at six
     * ever fired.
     *
     * The default storage is IN-MEMORY, which on Vercel means per-instance.
     * Ten warm instances is ten times the intended allowance, and the number
     * of warm instances is not something we control. Moving it to the database
     * makes one shared counter, which is the only kind that limits anything
     * here.
     *
     * Left to Better Auth rather than wrapped by ours: it knows which of its
     * own paths are credential endpoints, and a second limiter that always
     * fires later is dead code shaped like a control.
     */
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      // A ceiling for its endpoints generally. Better Auth applies a STRICTER
      // per-path rule to credential endpoints — measured, not assumed: sign-in
      // is refused after three attempts, not six. That is the right way round
      // for a password guess, so it is left alone rather than loosened to
      // match a number we picked.
      max: 6,
    },
    secret: env().BETTER_AUTH_SECRET,
    baseURL: env().APP_URL,

    /*
     * The public site and the studio are separate deployments. In the
     * split-origin shape they are separate ORIGINS too, and Better Auth
     * refuses a callbackURL to an origin it was not told about — the editor
     * would sign in and land on the public homepage instead of the draft they
     * opened. In the same-origin shape this collapses to a single entry.
     */
    trustedOrigins: trustedOrigins(env()),

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

      /*
       * Widen the session cookie to the parent domain when the studio lives on
       * its own subdomain. Spread conditionally rather than passing
       * `enabled: false`: with COOKIE_DOMAIN unset there is no parent to name,
       * and a host-scoped cookie is the stricter, correct default.
       */
      ...cookieScope(env().COOKIE_DOMAIN),
    },

    // Lets Server Actions set the session cookie. nextCookies is last.
    plugins: authPlugins(process.env),
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
