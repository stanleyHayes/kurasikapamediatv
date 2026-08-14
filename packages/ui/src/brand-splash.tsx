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
      <div className="w-full max-w-md border-y-2 border-on-surface bg-surface-container-lowest px-8 py-12 text-center broadcast-shadow">
        <div className="splash-mark mx-auto flex h-32 items-center justify-center">{logo}</div>
        <p className="broadcast-kicker mt-8 justify-center text-primary">Kurasikapa Media TV</p>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-none text-on-surface">The newsroom is coming into focus.</h1>
        <div className="mt-8 h-1 overflow-hidden bg-surface-container-high" aria-hidden><span className="splash-progress block h-full w-1/3 bg-secondary" /></div>
        <p className="mt-4 text-[10px] font-bold tracking-[.16em] text-on-surface-variant uppercase">{label}</p>
      </div>
    </main>
  )
}
