import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { SitePageKey } from '@kurasikapa/domain'
import { StandingPageView } from '../components/standing-page'
import { type PageKey } from './pages'
import { cmsPageFor } from './cms-page'
import { pageFor } from './pages'

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
  key: SitePageKey,
  path: string,
): {
  generateMetadata: (args: StandingParams) => Promise<Metadata>
  Page: (args: StandingParams) => Promise<React.ReactElement>
} {
  return {
    generateMetadata: async ({ params }: StandingParams): Promise<Metadata> => {
      const { locale } = await params
      const page = await cmsPageFor(key, locale)

      return {
        title: page.title,
        description: page.lead ?? page.sections[0]?.paragraphs[0],
        alternates: { canonical: `/${locale}/${path}` },
      }
    },

    Page: async ({ params }: StandingParams): Promise<React.ReactElement> => {
      const { locale } = await params
      setRequestLocale(locale)

      return <StandingPageView page={await cmsPageFor(key, locale)} pageKey={key} />
    },
  }
}

/** Static companion for durable institutional and legal copy. */
export function staticStandingRoute(
  key: PageKey,
  path: string,
): ReturnType<typeof standingRoute> {
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
