import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { securityHeaders } from '@kurasikapa/web-kit/security/headers'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  /**
   * The studio owns the `/studio` prefix, and owns it at the deployment level.
   *
   * This is what makes the two apps independently deployable onto one domain:
   * with a basePath, the studio's static assets are served from
   * `/studio/_next/*` instead of `/_next/*`, so a rewrite from the public site
   * cannot collide with the public build's chunks. Without it, both
   * deployments claim the same asset namespace and whichever answers second
   * serves a 404 for the other's JavaScript.
   *
   * It also means every in-app link stays prefix-free — Next adds the prefix
   * on render — so the rail and the top bar link to `/review`, not
   * `/studio/review`. See ADR-0011.
   */
  basePath: '/studio',

  // Partial Prerendering, same as the public app. The studio is mostly a
  // static shell around request-scoped holes, which is exactly what this models.
  cacheComponents: true,

  // The workspace packages ship as TypeScript source, not builds.
  transpilePackages: [
    '@kurasikapa/domain',
    '@kurasikapa/application',
    '@kurasikapa/web-kit',
    '@kurasikapa/ui',
    '@kurasikapa/adapter-mongo',
    '@kurasikapa/adapter-anthropic',
    '@kurasikapa/adapter-social',
    '@kurasikapa/adapter-email',
    '@kurasikapa/adapter-push',
    '@kurasikapa/adapter-rss',
    '@kurasikapa/adapter-ivs',
    '@kurasikapa/adapter-ovenmedia',
  ],

  typedRoutes: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },

  /*
   * Security headers on EVERY route, including /api — the same policy object
   * the public site uses, from the same module, so the two cannot drift.
   *
   * `source` is relative to basePath, so '/:path*' covers the whole studio.
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
