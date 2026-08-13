import type { Env } from './env'

/**
 * Where the other deployable lives.
 *
 * The public site and the studio are separate deployments that still link to
 * each other: the studio sends an unauthenticated editor to the site's
 * sign-in, and the site sends an editor to the studio. Neither can use a
 * relative path, because a relative path is only correct in one of the two
 * supported deployment shapes.
 *
 * Same-origin (the default): the studio is rewritten onto `/studio` of the
 * public domain, so `APP_URL` describes both and the fallbacks are exact.
 *
 * Split-origin: the studio has its own host. Set SITE_URL and STUDIO_URL
 * explicitly — and set Better Auth's cookie domain to the shared parent, or
 * the studio will not see the session the site issued. ADR-0011 § 4.
 *
 * Pure over `Env` rather than calling `env()`, so these are unit-testable the
 * way `parse` is. Callers pass `env()`.
 */
type Origins = Pick<Env, 'APP_URL' | 'SITE_URL' | 'STUDIO_URL'>

/**
 * Repeated here and in the studio's `basePath`, deliberately.
 *
 * They are separate builds: the studio's basePath is baked in at ITS build
 * time, so this cannot read it. Changing one means changing the other, which
 * is what ADR-0011 records.
 */
const STUDIO_BASE_PATH = '/studio'

const trimSlash = (url: string): string => url.replace(/\/+$/u, '')

/** Origin of the public site — where a reader, or a sign-in, belongs. */
export function siteUrl(env: Origins): string {
  return trimSlash(env.SITE_URL ?? env.APP_URL)
}

/** Origin AND base path of the studio — where an editor belongs. */
export function studioUrl(env: Origins): string {
  const configured = env.STUDIO_URL
  if (configured !== undefined) return trimSlash(configured)

  return `${trimSlash(env.APP_URL)}${STUDIO_BASE_PATH}`
}

/**
 * The site's sign-in page.
 *
 * Carries no `?callbackURL=`, deliberately. The sign-in page decides where a
 * successful sign-in lands, from the server — taking that destination from the
 * query string is how a sign-in form becomes an open redirect, and that
 * property was worth keeping through the split.
 *
 * The consequence is that an editor returns to the studio's home rather than
 * the draft they were opening. That was already true before the split; making
 * it better needs a signed or allowlisted destination, not a raw URL.
 */
export function signInUrl(env: Origins, locale: string): string {
  return `${siteUrl(env)}/${locale}/sign-in`
}

/**
 * Origins Better Auth will accept a callback for.
 *
 * Without the studio's origin in this list, split-origin sign-in silently
 * drops the `callbackURL` and returns the editor to the public homepage —
 * signed in, but nowhere near the draft they were opening. Deduplicated
 * because in the same-origin shape both entries are the same string.
 */
export function trustedOrigins(env: Origins): string[] {
  const origins = [siteUrl(env), studioUrl(env)].map((url) => new URL(url).origin)

  return [...new Set(origins)]
}

/**
 * The `advanced` fragment that widens the session cookie to a parent domain.
 *
 * Returns an EMPTY object when no domain is configured, rather than
 * `{ enabled: false }`. Same-origin is the default shape and a host-scoped
 * cookie is the stricter one — widening a cookie is a decision someone has to
 * make on purpose, by setting COOKIE_DOMAIN.
 */
export function cookieScope(
  domain: string | undefined,
): { crossSubDomainCookies?: { enabled: true; domain: string } } {
  if (domain === undefined || domain === '') return {}

  return { crossSubDomainCookies: { enabled: true, domain } }
}
