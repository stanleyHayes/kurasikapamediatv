import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@kurasikapa/web-kit/i18n/routing'
import '../globals.css'

/**
 * The studio's root document.
 *
 * Same fonts and same tokens as the public site — an editor should recognise
 * the product they are publishing to. What it deliberately does NOT carry:
 *
 * - Analytics. GA and a consent banner belong to the reader-facing site; the
 *   newsroom's own tool measuring its own staff is surveillance, not insight.
 * - A manifest, robots or a sitemap. The studio is `noindex` and installable
 *   by nobody.
 */
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit',
})

export const viewport: Viewport = {
  themeColor: '#064e19',
}

export const metadata: Metadata = {
  title: { default: 'Kurasikapa Studio', template: '%s · Kurasikapa Studio' },
  // An editorial CMS in a search index is a disclosure, not a feature. This is
  // belt to the authentication guard's braces.
  robots: { index: false, follow: false, nocache: true },
}

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function StudioRootLayout({
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
    <html lang={locale} className={outfit.variable}>
      <body className="bg-surface text-on-surface min-h-screen font-sans">
        {/* The studio carries no translated copy yet — see src/i18n/request.ts.
            The provider is still here so a component may format a date or a
            number in the editor's locale without extra wiring. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
