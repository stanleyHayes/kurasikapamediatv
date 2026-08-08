import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. Having both is a build error.
 */
export default createMiddleware(routing)

export const config = {
  // Everything except Next internals, the API surface, and files with an
  // extension. Matching those would put a locale prefix on asset URLs.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
