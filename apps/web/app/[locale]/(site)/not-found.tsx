import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

export const metadata: Metadata = { title: 'Not found', robots: { index: false, follow: false } }

export default async function NotFound(): Promise<React.ReactElement> {
  const t = await getTranslations('error')
  return <section className="paper-noise relative isolate min-h-[72dvh] overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest text-on-surface">
    <span aria-hidden className="absolute -bottom-[.18em] -right-[.03em] -z-10 select-none font-display text-[clamp(14rem,42vw,42rem)] font-black leading-none tracking-[-.1em] text-primary/[.055]">404</span>
    <div className="mx-auto grid min-h-[72dvh] max-w-[var(--container-page)] px-4 md:grid-cols-[8rem_minmax(0,1fr)] md:px-8">
      <aside className="hidden border-x border-on-surface/20 py-10 md:flex md:flex-col md:items-center md:justify-between"><span className="font-display text-5xl font-semibold text-primary">404</span><span className="-rotate-90 whitespace-nowrap text-[.65rem] font-bold uppercase tracking-[.25em]">Signal interrupted</span></aside>
      <div className="flex flex-col justify-center px-1 py-16 md:px-14 md:py-24">
        <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-primary"><span className="h-2 w-2 animate-pulse bg-secondary" />Off air · Story unavailable</p>
        <h1 className="mt-9 max-w-[11ch] font-display text-[clamp(4rem,9vw,8.5rem)] font-semibold leading-[.82] tracking-[-.075em]">This story left the bulletin.</h1>
        <div className="mt-10 grid gap-7 border-t-2 border-on-surface pt-7 lg:grid-cols-[1fr_18rem]">
          <div><p className="max-w-[52ch] text-xl font-medium leading-snug">{t('notFoundBody')}</p><p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-on-surface-variant">The address may be incomplete, or an editor may have removed the story while the newsroom checks the record.</p></div>
          <div className="border-l-4 border-secondary pl-5"><p className="font-display text-2xl font-semibold">The newsroom is still live.</p><p className="mt-2 text-sm text-on-surface-variant">Choose another route into today&rsquo;s reporting.</p></div>
        </div>
        <nav aria-label="Not found recovery" className="mt-10 flex flex-wrap gap-x-8 gap-y-4"><Link href="/news" className="border-b-2 border-primary pb-2 font-bold text-primary transition-colors hover:border-on-surface hover:text-on-surface">Latest reporting ↗</Link><Link href="/search" className="border-b-2 border-on-surface pb-2 font-bold transition-colors hover:border-primary hover:text-primary">Search the archive</Link><Link href="/" className="border-b-2 border-on-surface pb-2 font-bold transition-colors hover:border-primary hover:text-primary">Return to the front page</Link></nav>
      </div>
    </div>
  </section>
}
