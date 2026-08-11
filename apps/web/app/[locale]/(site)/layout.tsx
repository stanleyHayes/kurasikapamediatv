import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ServiceWorkerRegister } from '@/pwa/service-worker-register'

/**
 * The public site's chrome.
 *
 * A route group, so the studio can escape it. The Stitch editorial CMS is a
 * full-screen admin shell with its own docked rail — wrapping it in the
 * reader's masthead and footer is not a smaller version of that design, it is
 * a different one. A nested layout cannot remove a parent's chrome, so the
 * chrome moved down here instead of the studio trying to opt out.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('nav')

  return (
    <>
      <SiteHeader liveLabel={t('live')} />

      {/* pt for the fixed header, per the design's `pt-20` on <main>. */}
      <main className="pt-20">{children}</main>

      <SiteFooter />
      <ServiceWorkerRegister />
    </>
  )
}
