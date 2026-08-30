import { cacheLife } from 'next/cache'
import Image from 'next/image'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { FooterNav } from './footer-nav'

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="mt-24 border-t-8 border-secondary bg-[#08150d] text-white">
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-[var(--container-page)] gap-7 px-5 py-10 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div><p className="broadcast-kicker text-secondary">Reader dispatch</p><p className="mt-4 max-w-2xl font-display text-4xl leading-[.95] tracking-[-0.05em] md:text-6xl">The day, edited.<br />Not inflated.</p></div>
          <Link href="/newsletter" className="editorial-card w-fit border-2 border-secondary bg-secondary px-6 py-3 text-sm font-bold text-on-secondary hover:bg-white hover:text-primary">Join the briefing <span aria-hidden className="ml-2">↗</span></Link>
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-page)] px-5 py-14 md:px-8 md:py-20">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_1.85fr]">
          <div>
            <Image src="/brand-logo-transparent.png" alt="Kurasikapa Media" width={1536} height={1024} className="h-28 w-auto object-contain object-left" />
            <p className="mt-5 max-w-sm border-l-2 border-secondary pl-5 text-base leading-relaxed text-white/58">Independent television and digital journalism from Ghana. Reporting that informs, educates and keeps power in view.</p>
          </div>
          <FooterNav />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[var(--container-page)] flex-col gap-2 px-5 py-5 text-xs text-white/52 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p>© <CopyrightYear /> Kurasikapa Media TV</p>
          <p>Accra, Ghana · Reporting without borders</p>
        </div>
      </div>
    </footer>
  )
}

// eslint-disable-next-line @typescript-eslint/require-await -- `use cache` requires async.
async function CopyrightYear(): Promise<React.ReactElement> {
  'use cache'
  cacheLife('days')
  return <>{new Date().getUTCFullYear()}</>
}
