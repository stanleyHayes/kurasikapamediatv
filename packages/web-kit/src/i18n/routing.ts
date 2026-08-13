import { defineRouting } from 'next-intl/routing'

/**
 * Launch locales. Local languages are added here as data — see docs/01-brd.md
 * § 6, which tracks confirming which ones with the client.
 *
 * `localePrefix: 'always'` keeps every URL unambiguous, which matters for SEO
 * canonicals and for the per-locale sitemaps.
 */
export const routing = defineRouting({
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]

export const isSupportedLocale = (value: string): value is Locale =>
  (routing.locales as readonly string[]).includes(value)
