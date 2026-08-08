import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { StandingPageView } from '../components/standing-page'
import { type PageKey, pageFor } from './pages'

export interface StandingParams {
  params: Promise<{ locale: string }>
}

/**
 * Builds the two exports a standing page route needs.
 *
 * Six routes differing only in a content key is duplication, but the URLs are
 * fixed by the questionnaire and Next derives them from directories — so the
 * folders stay and the bodies collapse to one line each. The alternative, a
 * catch-all under /pages/, would have changed every published URL to save
 * some files.
 */
export function standingRoute(
  key: PageKey,
  path: string,
): {
  generateMetadata: (args: StandingParams) => Promise<Metadata>
  Page: (args: StandingParams) => Promise<React.ReactElement>
} {
  return {
    generateMetadata: async ({ params }: StandingParams): Promise<Metadata> => {
      const { locale } = await params
      const page = pageFor(key, locale)

      return {
        title: page.title,
        description: page.lead ?? page.sections[0]?.paragraphs[0],
        alternates: { canonical: `/${locale}/${path}` },
      }
    },

    Page: async ({ params }: StandingParams): Promise<React.ReactElement> => {
      const { locale } = await params
      setRequestLocale(locale)

      return <StandingPageView page={pageFor(key, locale)} />
    },
  }
}
