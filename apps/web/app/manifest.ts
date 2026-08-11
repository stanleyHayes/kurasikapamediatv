import type { MetadataRoute } from 'next'

/**
 * Installable reader app. Offline coverage is the service worker's job —
 * this file only tells the OS what to put on the home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kurasikapa Media TV',
    short_name: 'Kurasikapa',
    description:
      'Television and digital journalism that educates, motivates and informs.',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    background_color: '#131b2e',
    theme_color: '#131b2e',
    lang: 'en',
    categories: ['news', 'magazines'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
