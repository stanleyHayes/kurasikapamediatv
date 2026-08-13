import { getRequestConfig } from 'next-intl/server'
import { isSupportedLocale, routing } from '@kurasikapa/web-kit/i18n/routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  // An unknown locale falls back rather than 404s: a stale share link with a
  // dropped locale should still show the reader the article.
  const locale = requested !== undefined && isSupportedLocale(requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: ((await import(`../../messages/${locale}.json`)) as { default: Record<string, unknown> })
      .default,
  }
})
