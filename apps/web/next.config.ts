import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

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
  ],

  typedRoutes: true,

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Next's config contract types this as async; there is nothing to await.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
