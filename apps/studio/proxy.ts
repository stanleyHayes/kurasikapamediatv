import createMiddleware from 'next-intl/middleware'
import { routing } from '@kurasikapa/web-kit/i18n/routing'

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. Having both is a build error.
 *
 * Locale routing only, same as the public app. Security headers are NOT set
 * here — see web-kit's security/headers.ts for why they live in
 * next.config.ts instead.
 *
 * The matcher is relative to basePath: Next strips `/studio` before the proxy
 * sees the path, so these patterns are the same ones the public app uses.
 */
export default createMiddleware(routing)

export const config = {
  // Everything except Next internals, the API surface, and files with an
  // extension. Matching those would put a locale prefix on asset URLs.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
