import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { securityHeaders } from './src/security/headers'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Partial Prerendering. A news site is mostly static shell plus a few
  // reader-specific holes, which is exactly what this models.
  // See docs/03-architecture.md § 5.
  cacheComponents: true,

  // The domain and application packages ship as TypeScript source, not builds.
  transpilePackages: [
    '@kurasikapa/domain',
    '@kurasikapa/application',
    '@kurasikapa/adapter-mongo',
    '@kurasikapa/adapter-anthropic',
    '@kurasikapa/adapter-social',
    '@kurasikapa/adapter-email',
    '@kurasikapa/adapter-push',
    '@kurasikapa/adapter-rss',
  ],

  typedRoutes: true,

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  /*
   * Security headers on EVERY route, including /api.
   *
   * Set here rather than in proxy.ts on purpose. The proxy's matcher excludes
   * the API surface — so headers set there would miss the auth and AI
   * endpoints entirely — and a header applied at the CDN edge costs nothing
   * per request, where a proxy costs an invocation.
   *
   * The policy itself lives in src/security/headers.ts so it can be tested.
   */
  // Next's config contract types this as async; there is nothing to await.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    const headers = securityHeaders(process.env.NODE_ENV === 'development')

    return [
      {
        source: '/:path*',
        headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
      },
    ]
  },
}

export default withNextIntl(nextConfig)
