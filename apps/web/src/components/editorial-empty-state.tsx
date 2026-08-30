import { Link } from '@kurasikapa/web-kit/i18n/navigation'

interface EditorialEmptyStateProps {
  readonly surface: 'home' | 'news' | 'section'
  readonly sectionName?: string | undefined
}

const expectations = [
  ['01', 'Ghana first', 'Reporting rooted in the people and places shaping the country.'],
  ['02', 'Context included', 'News that explains what changed, who it affects and what comes next.'],
  ['03', 'Two editions', 'English and French coverage, edited by the same independent newsroom.'],
] as const

export function EditorialEmptyState({
  surface,
  sectionName,
}: EditorialEmptyStateProps): React.ReactElement {
  const isHome = surface === 'home'
  const headline = surface === 'section' && sectionName !== undefined
    ? `${sectionName} reporting is underway.`
    : isHome ? 'The first edition is taking shape.' : 'Reporting is underway.'

  return (
    <section className="signal-grid relative isolate overflow-hidden border-y-4 border-on-surface bg-surface-container-lowest text-on-surface">
      <div aria-hidden className="absolute right-[-0.04em] top-[-0.18em] -z-10 select-none font-display text-[9rem] font-black leading-none tracking-[-0.08em] text-primary/[0.07] md:text-[17rem]">
        EDITION 00
      </div>
      <div aria-hidden className="absolute bottom-0 left-0 h-3 w-2/3 bg-secondary" />

      <div className="mx-auto grid max-w-[var(--container-page)] lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="px-6 py-16 md:px-10 md:py-24 lg:border-r-2 lg:border-on-surface lg:px-14 lg:py-28">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="eyebrow bg-primary px-3 py-2 text-white">Newsroom status</span>
            <span className="eyebrow text-primary-ink">Accra · Edition 00</span>
          </div>

          <h1 className="max-w-[11ch] font-display text-5xl font-semibold leading-[0.92] tracking-[-0.05em] md:text-[length:var(--text-display-lg)]">
            {headline}
          </h1>
          <p className="mt-7 max-w-2xl border-l-4 border-secondary pl-5 text-[length:var(--text-body-lg)] leading-relaxed text-on-surface-variant">
            Our editors are preparing Kurasikapa&apos;s opening stories. This page will update the
            moment the first verified report goes live.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/newsletter" className="bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-inverse-surface">
              Join the reader dispatch ↗
            </Link>
            <Link href="/about" className="border-2 border-on-surface px-6 py-3 font-bold transition-colors hover:bg-on-surface hover:text-white">
              How we report
            </Link>
          </div>
        </div>

        <Expectations />
      </div>
    </section>
  )
}

function Expectations(): React.ReactElement {
  return (
    <aside className="bg-surface-container-low px-6 py-12 md:px-10 lg:py-20" aria-label="What to expect">
      <p className="eyebrow mb-8 text-secondary-ink">What to expect</p>
      <div className="divide-y divide-outline-variant border-y border-outline-variant">
        {expectations.map(([number, title, body]) => (
          <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-4 py-6">
            <span className="font-mono text-sm font-bold text-primary-ink">{number}</span>
            <div>
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm font-semibold text-on-surface-variant">
        Independent television and digital journalism from Ghana.
      </p>
    </aside>
  )
}
