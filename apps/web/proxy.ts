import createMiddleware from 'next-intl/middleware'
import { routing } from '@kurasikapa/web-kit/i18n/routing'

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. Having both is a build error.
 *
 * Locale routing only. Security headers are NOT set here, deliberately — see
 * src/security/headers.ts for why they live in next.config.ts instead.
 */
export default createMiddleware(routing)

export const config = {
  /*
   * Everything except Next internals, the API surface, `/studio`, and files
   * with an extension. Matching those would put a locale prefix on asset URLs.
   *
   * `studio` is excluded because that prefix belongs to the OTHER deployment.
   * In the same-origin shape it is rewritten away — but middleware runs BEFORE
   * a rewrite, so without this exclusion next-intl sees a path with no locale
   * and 307s `/studio/en` to `/en/studio/en`, which exists nowhere. The studio
   * runs its own locale middleware behind its basePath. ADR-0011.
   */
  matcher: ['/((?!api|studio|_next|_vercel|.*\\..*).*)'],
}
