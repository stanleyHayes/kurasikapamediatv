import type { MetadataRoute } from 'next'
import { env } from '@kurasikapa/web-kit/composition/env'

export default function robots(): MetadataRoute.Robots {
  const base = env().APP_URL

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        /*
         * `/studio/`, not `/en/studio/`: the studio is its own deployment with
         * its own basePath, so the locale now comes AFTER the prefix
         * (`/studio/en/...`). The old per-locale entries matched nothing.
         *
         * This only bites in the same-origin shape, where the studio is
         * rewritten onto this domain. On its own host the studio is not in
         * this file's scope at all — it serves `noindex` from its own root
         * layout, which is the control either way. /api has nothing to index.
         */
        disallow: ['/api/', '/studio/'],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  }
}
