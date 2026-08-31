export interface DashboardDatum {
  readonly label: string
  readonly value: number
  readonly color: string
}

export function DashboardInsights({
  workflow,
  published,
  attention,
}: {
  readonly workflow: readonly DashboardDatum[]
  readonly published: readonly DashboardDatum[]
  readonly attention: readonly DashboardDatum[]
}): React.ReactElement {
  return (
    <section aria-labelledby="desk-insights" className="border-y-2 border-on-surface bg-surface-container-lowest">
      <header className="border-b border-outline-variant px-5 py-5 md:px-6">
        <p className="broadcast-kicker text-primary">Desk pulse</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 id="desk-insights" className="font-display text-2xl font-semibold text-on-surface">What needs attention now</h2>
          <p className="max-w-xl text-sm text-on-surface-variant">Live workflow signals from the editorial and moderation queues. Publication figures show the latest 50 items per language.</p>
        </div>
      </header>
      <div className="grid lg:grid-cols-[1.35fr_.85fr_1fr]">
        <BarPanel title="Your workflow" data={workflow} />
        <LanguagePanel data={published} />
        <BarPanel title="Decision queues" data={attention} />
      </div>
    </section>
  )
}

function BarPanel({ title, data }: { title: string; data: readonly DashboardDatum[] }): React.ReactElement {
  const maximum = Math.max(1, ...data.map((item) => item.value))
  return (
    <article className="border-b border-outline-variant p-5 lg:border-b-0 lg:border-r md:p-6">
      <h3 className="font-display text-lg font-semibold text-on-surface">{title}</h3>
      <div className="mt-6 space-y-5">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-baseline justify-between gap-3 text-sm"><span className="text-on-surface-variant">{item.label}</span><strong className="font-mono tabular-nums text-on-surface">{item.value}</strong></div>
            <div className="h-2 bg-surface-container-high" aria-hidden><span className={`block h-full origin-left transition-transform duration-500 ${item.color}`} style={{ transform: `scaleX(${String(item.value / maximum)})` }} /></div>
          </div>
        ))}
      </div>
    </article>
  )
}

function LanguagePanel({ data }: { data: readonly DashboardDatum[] }): React.ReactElement {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const first = data[0]?.value ?? 0
  const angle = total === 0 ? 0 : Math.round((first / total) * 360)
  return (
    <article className="border-b border-outline-variant p-5 lg:border-b-0 lg:border-r md:p-6">
      <h3 className="font-display text-lg font-semibold text-on-surface">Published languages</h3>
      <div className="mt-6 flex items-center gap-6">
        <div className="relative grid size-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) 0deg ${String(angle)}deg, var(--color-secondary) ${String(angle)}deg 360deg)` }}>
          <div className="grid size-18 place-items-center rounded-full bg-surface-container-lowest text-center"><span><strong className="block font-display text-2xl tabular-nums">{total}</strong><small className="text-[9px] font-bold tracking-wider text-on-surface-variant uppercase">latest</small></span></div>
        </div>
        <ul className="min-w-0 flex-1 space-y-3">
          {data.map((item) => <li key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-on-surface-variant"><span className={`size-2.5 ${item.color}`} />{item.label}</span><strong className="font-mono tabular-nums">{item.value}</strong></li>)}
        </ul>
      </div>
    </article>
  )
}
