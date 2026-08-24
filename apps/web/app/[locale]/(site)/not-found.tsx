import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import Image from 'next/image'

/**
 * noindex lives HERE, not on the pages that call notFound().
 *
 * A page that calls notFound() can set its own robots metadata, but not every
 * route that renders this boundary does. Declaring it here means every
 * not-found response is noindex whatever produced it — belt and braces with
 * the article page, which sets it too.
 */
export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
}

export default async function NotFound(): Promise<React.ReactElement> {
  const t = await getTranslations('error')

  return (
    <section className="paper-noise mx-auto max-w-[var(--container-page)] px-4 py-8 md:px-8 md:py-14">
      <div className="grid overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest lg:grid-cols-[1fr_18rem]">
        <div className="px-7 py-16 md:px-16 md:py-24"><p className="broadcast-kicker mb-7 text-secondary-ink">404 · Off air</p><h1 className="font-display max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-on-surface md:text-[length:var(--text-display-lg)]">{t('notFound')}</h1><p className="mt-6 max-w-prose text-[length:var(--text-body-lg)] text-on-surface-variant">{t('notFoundBody')}</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/" className="bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-inverse-surface">Return home ↗</Link><Link href="/news" className="border border-on-surface px-6 py-3 font-bold text-on-surface hover:bg-on-surface hover:text-white">Latest news</Link><Link href="/search" className="border border-outline px-6 py-3 font-bold text-on-surface hover:border-primary hover:text-primary-ink">Search</Link></div></div>
        <div className="signal-grid relative flex min-h-64 items-center justify-center border-t-2 border-on-surface bg-primary p-8 lg:border-l-2 lg:border-t-0"><span aria-hidden className="absolute text-[12rem] font-black leading-none text-white/10">404</span><Image src="/brand-logo-transparent.png" alt="Kurasikapa Media" width={1536} height={1024} className="relative h-36 w-auto object-contain" /></div>
      </div>
    </section>
  )
}
