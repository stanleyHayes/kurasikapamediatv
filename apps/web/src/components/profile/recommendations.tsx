import { Link } from '@kurasikapa/web-kit/i18n/navigation'

export interface RecommendationView {
  readonly id: string
  readonly slug: string
  readonly title: string
}

export function Recommendations({
  items,
  basis,
}: {
  readonly items: readonly RecommendationView[]
  readonly basis: string | null
}): React.ReactElement | null {
  if (items.length === 0 || basis === null) return null
  return (
    <section className="signal-grid mt-12 border-2 border-outline bg-surface-container-lowest p-7 md:p-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Recommended for you</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <h2 className="font-display text-4xl font-semibold tracking-[-.04em]">Continue beyond “{basis}”</h2>
        <span className="font-mono text-xs text-on-surface-variant">Private reading signal</span>
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="border border-outline bg-surface p-5 shadow-[6px_6px_0_var(--color-outline)]">
            <span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">
              <Link href={`/articles/${item.slug}`} className="hover:text-primary">{item.title}</Link>
            </h3>
          </li>
        ))}
      </ul>
    </section>
  )
}
