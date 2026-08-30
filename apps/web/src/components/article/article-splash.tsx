import Image from 'next/image'

export function ArticleSplash(): React.ReactElement {
  return <section className="paper-noise grid min-h-[70dvh] place-items-center bg-surface px-6" aria-label="Preparing the story">
    <div className="w-full max-w-4xl border-y-2 border-on-surface py-10">
      <div className="flex items-center justify-between"><Image src="/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-16 w-auto object-contain" priority /><span className="font-mono text-xs font-bold uppercase tracking-[.18em]">Story incoming</span></div>
      <div className="my-12 grid grid-cols-[1fr_2fr_4fr] gap-2" aria-hidden><span className="h-2 animate-pulse bg-secondary" /><span className="h-2 animate-pulse bg-primary [animation-delay:150ms]" /><span className="h-2 animate-pulse bg-on-surface [animation-delay:300ms]" /></div>
      <p className="font-display text-4xl font-semibold leading-[.92] tracking-[-.05em] md:text-6xl">Preparing the next<br />part of the record.</p>
      <p className="mt-6 text-sm text-on-surface-variant">Loading verified reporting, context and reader tools.</p>
    </div>
  </section>
}
