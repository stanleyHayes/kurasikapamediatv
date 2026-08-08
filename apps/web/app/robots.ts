import type { MetadataRoute } from 'next'
import { env } from '@/composition/env'

export default function robots(): MetadataRoute.Robots {
  const base = env().APP_URL

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The studio is behind auth, but a crawler should not waste budget
        // discovering that, and /api has nothing to index.
        disallow: ['/api/', '/en/studio/', '/fr/studio/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
