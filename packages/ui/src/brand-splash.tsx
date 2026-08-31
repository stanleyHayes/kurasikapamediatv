import type { ReactNode } from 'react'

export function BrandSplash({
  logo,
  label,
}: {
  readonly logo: ReactNode
  readonly label: string
}): React.ReactElement {
  return (
    <main className="paper-noise signal-grid grid min-h-[100dvh] place-items-center bg-surface px-6" aria-busy="true" aria-label={label}>
      <div className="relative w-full max-w-lg overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest px-8 py-11 text-left broadcast-shadow md:px-12">
        <span aria-hidden className="absolute right-0 top-0 h-full w-2 bg-secondary" />
        <div className="flex items-center justify-between gap-6">
          <div className="splash-mark flex h-24 items-center justify-start">{logo}</div>
          <span className="font-mono text-[10px] font-bold tracking-[.18em] text-on-surface-variant uppercase">Signal 001</span>
        </div>
        <p className="broadcast-kicker mt-7 text-primary">Kurasikapa Media TV</p>
        <h1 className="mt-4 max-w-sm text-balance font-display text-3xl font-semibold leading-[1.05] tracking-tight text-on-surface md:text-4xl">Bringing the newsroom online.</h1>
        <div className="mt-8 h-1 overflow-hidden bg-surface-container-high" aria-hidden><span className="splash-progress block h-full w-1/3 bg-secondary" /></div>
        <div className="mt-4 flex items-center justify-between gap-4"><p className="text-[10px] font-bold tracking-[.16em] text-on-surface-variant uppercase">{label}</p><span aria-hidden className="flex gap-1"><i className="size-1 bg-primary"/><i className="size-1 bg-primary/60"/><i className="size-1 bg-primary/25"/></span></div>
      </div>
    </main>
  )
}
