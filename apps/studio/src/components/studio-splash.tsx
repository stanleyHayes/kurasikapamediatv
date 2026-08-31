import Image from 'next/image'

export function StudioSplash(): React.ReactElement {
  return (
    <main className="grid min-h-[100dvh] bg-inverse-surface text-white lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,.85fr)]" aria-busy="true" aria-label="Opening the editorial workspace">
      <section className="paper-noise signal-grid relative flex min-h-[62dvh] flex-col justify-between overflow-hidden bg-primary px-7 py-9 md:px-12 md:py-12 lg:min-h-[100dvh] lg:px-16 lg:py-14">
        <div className="flex items-center justify-between gap-6">
          <Image src="/studio/brand-logo-transparent.png" alt="Kurasikapa Media TV" width={1536} height={1024} className="splash-mark h-20 w-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,.18)] md:h-28" priority />
          <span className="border border-white/25 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-white/70">Studio 01</span>
        </div>

        <div className="relative max-w-3xl py-14">
          <p className="broadcast-kicker text-secondary">Protected editorial workspace</p>
          <h1 className="mt-6 max-w-[11ch] font-display text-5xl font-bold leading-[.9] tracking-[-.055em] md:text-7xl xl:text-8xl">The newsroom is coming into focus.</h1>
          <p className="mt-7 max-w-xl border-l-4 border-secondary pl-5 text-base leading-7 text-white/75 md:text-lg">Preparing your desk, live queues and editorial signals.</p>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/55">Kurasikapa Media TV · Accra newsroom</p>
      </section>

      <section className="relative flex min-h-[38dvh] items-center px-7 py-12 md:px-12 lg:min-h-[100dvh] lg:px-14">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs font-bold uppercase tracking-[.2em] text-secondary">Opening workspace</p>
          <div className="mt-7 overflow-hidden border-y border-white/20 py-6">
            <div className="h-1 overflow-hidden bg-white/10" aria-hidden><span className="splash-progress block h-full w-1/3 bg-secondary" /></div>
            <div className="mt-5 flex items-center justify-between gap-5">
              <p className="text-sm leading-6 text-white/65">Synchronising the editorial desk</p>
              <span aria-hidden className="flex gap-1.5"><i className="size-1.5 animate-bounce bg-secondary"/><i className="size-1.5 animate-bounce bg-secondary [animation-delay:120ms]"/><i className="size-1.5 animate-bounce bg-secondary [animation-delay:240ms]"/></span>
            </div>
          </div>
          <p className="mt-6 text-xs leading-5 text-white/40">Drafts stay private. Publication always requires a human decision.</p>
        </div>
      </section>
    </main>
  )
}
