export default function WorkspaceLoading(): React.ReactElement {
  return (
    <main className="min-h-full space-y-8 p-4 pb-20 md:p-7" aria-busy="true" aria-label="Loading workspace">
      <section className="grid border-y-2 border-on-surface sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="min-h-32 border-b border-outline-variant bg-surface-container-lowest p-6 sm:border-r"><div className="h-3 w-24 animate-pulse bg-surface-container-high"/><div className="mt-5 h-10 w-16 animate-pulse bg-surface-container-high"/></div>)}
      </section>
      <section className="border-y-2 border-on-surface bg-surface-container-lowest p-6" aria-hidden>
        <div className="flex items-center justify-between"><div><div className="h-3 w-20 animate-pulse bg-primary/20"/><div className="mt-3 h-7 w-64 max-w-full animate-pulse bg-surface-container-high"/></div><span className="flex items-center gap-2 text-xs font-bold tracking-wider text-primary uppercase"><i className="size-1.5 animate-bounce rounded-full bg-primary"/><i className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]"/><i className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]"/>Loading desk</span></div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-36 animate-pulse bg-surface-container-low"/>)}</div>
      </section>
    </main>
  )
}
