import { getRequestConfig } from 'next-intl/server'
import { isSupportedLocale, routing } from '@kurasikapa/web-kit/i18n/routing'

/**
 * The studio carries no translated copy.
 *
 * It shares the public site's locale ROUTING — an editor works on the French
 * edition at `/studio/fr/...` and the locale is what tells the use cases which
 * article family they are editing — but its chrome is English, because the
 * newsroom works in English and no French CMS copy has been written or
 * reviewed. Shipping machine-translated admin labels would be inventing copy
 * nobody signed off on.
 *
 * So: no messages, deliberately. When the studio does get translated copy, add
 * a `messages/` directory here and load it exactly as apps/web does — the
 * routing half already works.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale =
    requested !== undefined && isSupportedLocale(requested) ? requested : routing.defaultLocale

  return { locale, messages: {} }
})
