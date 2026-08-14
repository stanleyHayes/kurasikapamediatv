import type { Metadata } from 'next'
import Image from 'next/image'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

export const metadata: Metadata = {
  title: 'Workspace not found',
  robots: { index: false, follow: false },
}

export default function StudioNotFound(): React.ReactElement {
  return (
    <main className="paper-noise signal-grid grid min-h-[100dvh] place-items-center bg-surface p-5 md:p-10">
      <section className="grid w-full max-w-5xl overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest lg:grid-cols-[1fr_18rem]">
        <div className="p-8 md:p-14">
          <p className="broadcast-kicker text-secondary">404 · Desk missing</p>
          <h1 className="mt-8 max-w-[12ch] font-display text-5xl font-semibold leading-[.9] text-on-surface md:text-7xl">That workspace is off the rundown.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-on-surface-variant">The address may have changed, or the newsroom tool you followed is not available. Return to Editorial or open the review desk.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link href="/" className="bg-primary px-6 py-3 font-bold text-white hover:bg-inverse-surface">Editorial desk ↗</Link><Link href="/review" className="border border-on-surface px-6 py-3 font-bold text-on-surface hover:bg-on-surface hover:text-white">Review queue</Link></div>
        </div>
        <div className="signal-grid relative flex min-h-64 items-center justify-center border-t-2 border-on-surface bg-primary p-8 lg:border-l-2 lg:border-t-0"><span aria-hidden className="absolute text-[12rem] font-black leading-none text-white/10">404</span><Image src="/studio/brand-logo-transparent.png" alt="Kurasikapa Media" width={1536} height={1024} className="relative h-36 w-auto object-contain" /></div>
      </section>
    </main>
  )
}
