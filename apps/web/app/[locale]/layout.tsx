import type { Metadata, Viewport } from 'next'
import { Outfit, Playfair_Display } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AnalyticsRoot } from '@/analytics/analytics-root'
import { routing } from '@kurasikapa/web-kit/i18n/routing'
import '../globals.css'

/**
 * Self-hosted via next/font: the files are served from our own origin, so
 * there is no request to Google on a reader's first paint and no third-party
 * dependency on the critical path — which also matters under GDPR.
 *
 * `display: swap` shows the fallback immediately rather than holding text
 * invisible while a font downloads. On a news site, words first.
 */
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-playfair',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-outfit',
})

export const viewport: Viewport = {
  themeColor: '#131b2e',
}

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return {
    title: { default: 'Kurasikapa Media TV', template: '%s · Kurasikapa Media TV' },
    description:
      'Television and digital journalism that educates, motivates and informs — from Kurasikapa Media TV.',
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: { type: 'website', siteName: 'Kurasikapa Media TV', locale },
    twitter: { card: 'summary_large_image' },
    appleWebApp: { capable: true, title: 'Kurasikapa', statusBarStyle: 'black-translucent' },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  // Opts this route into static rendering; without it every page becomes
  // dynamic the moment a translation is read.
  setRequestLocale(locale)

  return (
    <html lang={locale} className={`${playfair.variable} ${outfit.variable}`}>
      <body className="bg-surface text-on-surface min-h-screen">
        {/* Chrome lives in the (site) group, not here — the studio is a
            full-screen admin shell and must not inherit the masthead. */}
        <NextIntlClientProvider>
          {children}
          <AnalyticsRoot measurementId={process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] ?? ''} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
