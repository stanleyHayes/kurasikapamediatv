export default function WorkspaceLoading(): React.ReactElement {
  return (
    <main className="grid min-h-[72dvh] place-items-center p-4 pb-20 md:p-8" aria-busy="true" aria-label="Opening the newsroom workspace">
      <section role="status" className="paper-noise signal-grid relative w-full max-w-5xl overflow-hidden border-y-4 border-on-surface bg-surface-container-lowest px-6 py-12 md:px-12 md:py-16">
        <div aria-hidden className="absolute -right-12 -top-20 font-display text-[14rem] font-black leading-none text-primary/5">K</div>
        <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_22rem]">
          <div><p className="broadcast-kicker text-primary">Kurasikapa newsroom</p><h1 className="mt-5 max-w-2xl font-display text-4xl font-bold tracking-[-.045em] text-on-surface md:text-6xl">Preparing your editorial desk.</h1><p className="mt-5 max-w-xl text-base leading-7 text-on-surface-variant">Bringing drafts, review queues and live publication signals into one workspace.</p><div className="mt-9 h-1.5 max-w-md overflow-hidden bg-surface-container-high"><span className="splash-progress block h-full w-1/4 bg-secondary" /></div><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-primary"><LoadingDots /> Opening newsroom</span></div>
          <div aria-hidden className="depth-stage relative mx-auto h-64 w-full max-w-xs"><span className="absolute inset-x-9 top-2 h-44 border border-outline bg-primary-container shadow-[.75rem_.75rem_0_rgba(7,133,42,.10)]"/><span className="absolute inset-x-5 top-10 h-44 border border-outline bg-surface-container shadow-[.75rem_.75rem_0_rgba(227,154,10,.16)]"/><span className="absolute inset-x-0 top-20 h-44 border-t-4 border-secondary bg-inverse-surface p-6 text-white shadow-[.85rem_.85rem_0_rgba(7,133,42,.20)]"><i className="block h-2 w-20 bg-secondary"/><i className="mt-5 block h-4 w-4/5 bg-white/70"/><i className="mt-3 block h-2 w-full bg-white/20"/><i className="mt-2 block h-2 w-2/3 bg-white/20"/><span className="absolute bottom-5 right-5 size-8 animate-pulse border border-secondary"/></span></div>
        </div>
      </section>
    </main>
  )
}

function LoadingDots(): React.ReactElement { return <span aria-hidden className="inline-flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-current"/><i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
