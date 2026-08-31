import type { NewsroomReport, RankedMetric, TrendPoint } from '@kurasikapa/application'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

const percent = (part: number, total: number): string => total === 0 ? '0%' : `${String(Math.round(part / total * 100))}%`

export function NewsroomAnalytics({ report, days }: { report: NewsroomReport; days: number }): React.ReactElement {
  const metrics = [
    { label: 'Article views', value: report.views.toLocaleString(), detail: `Last ${String(days)} days` },
    { label: 'Unique readers', value: report.uniqueReaders.toLocaleString(), detail: 'Consent-based, deduplicated' },
    { label: 'Returning readers', value: percent(report.returningReaders, report.uniqueReaders), detail: `${String(report.returningReaders)} came back` },
    { label: 'Stories per reader', value: report.uniqueReaders === 0 ? '0' : (report.views / report.uniqueReaders).toFixed(1), detail: 'Engagement depth' },
    { label: 'Newsletter audience', value: report.newsletterSubscribers.toLocaleString(), detail: `+${String(report.newsletterGrowth)} this period` },
  ]
  return <div className="space-y-8 pb-20">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-on-surface pb-6"><div><p className="broadcast-kicker text-primary">Audience intelligence</p><h2 className="mt-2 font-display text-4xl font-semibold">Newsroom performance</h2><p className="mt-3 max-w-2xl text-sm text-on-surface-variant">First-party, consent-aware reporting. Every figure below comes from recorded production data.</p></div><nav aria-label="Report period" className="flex border border-outline-variant">{[7, 30, 90].map((period) => <Link key={period} href={`/analytics?days=${String(period)}`} aria-current={days === period ? 'page' : undefined} className={`px-4 py-3 text-xs font-bold ${days === period ? 'bg-primary text-white' : 'bg-surface-container-lowest'}`}>{period} days</Link>)}</nav></header>
    <section aria-label="Audience KPIs" className="depth-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric, index) => <article key={metric.label} className={`min-h-40 border-b border-on-surface p-6 shadow-[7px_8px_0_rgba(16,75,42,.12)] ${index === 0 ? 'bg-primary text-white' : 'bg-surface-container-lowest'}`}><p className={`text-xs font-bold uppercase tracking-[.15em] ${index === 0 ? 'text-white/65' : 'text-on-surface-variant'}`}>{metric.label}</p><strong className="mt-6 block font-display text-4xl tabular-nums">{metric.value}</strong><p className={`mt-2 text-xs ${index === 0 ? 'text-white/70' : 'text-on-surface-variant'}`}>{metric.detail}</p></article>)}</section>
    <section className="depth-grid grid gap-3 xl:grid-cols-[1.6fr_1fr]"><TrafficChart points={report.traffic} /><RankPanel title="Acquisition channels" rows={report.acquisition} total={report.views} /></section>
    <section className="depth-grid grid gap-3 lg:grid-cols-3"><RankPanel title="Top stories" rows={report.topStories} total={report.views} /><RankPanel title="Top categories" rows={report.topCategories} total={report.views} /><RankPanel title="Top authors" rows={report.topAuthors} total={report.views} /></section>
    <section className="border-y-2 border-on-surface bg-surface-container-lowest p-6 shadow-[7px_8px_0_rgba(16,75,42,.12)]"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="broadcast-kicker text-primary">Search and growth</p><h3 className="mt-2 font-display text-2xl font-semibold">Discovery health</h3></div><p className="font-display text-3xl font-semibold">{percent(report.searchViews, report.views)} <span className="text-sm font-normal text-on-surface-variant">of views from search</span></p></div><div className="mt-6"><MiniBars rows={report.newsletterTrend} empty="Newsletter confirmations will form a daily growth chart here." /></div></section>
  </div>
}

function TrafficChart({ points }: { points: readonly TrendPoint[] }): React.ReactElement {
  const max = Math.max(1, ...points.map((point) => point.views))
  return <article className="border-b border-on-surface bg-surface-container-lowest p-6 shadow-[7px_8px_0_rgba(16,75,42,.12)]"><p className="broadcast-kicker text-primary">Traffic trend</p><h3 className="mt-2 font-display text-2xl font-semibold">Views and unique readers</h3>{points.length === 0 ? <p className="mt-12 border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">Traffic will appear after consenting readers open published stories.</p> : <div className="mt-8 flex h-52 items-end gap-1" role="img" aria-label="Daily article views"><span className="sr-only">{points.map((point) => `${point.label}: ${String(point.views)} views, ${String(point.uniqueReaders)} unique readers`).join('; ')}</span>{points.map((point) => <div key={point.label} className="group flex min-w-0 flex-1 items-end gap-px" style={{ height: `${String(Math.max(8, point.views / max * 100))}%` }} title={`${point.label}: ${String(point.views)} views`}><span className="h-full flex-1 bg-primary transition-opacity group-hover:opacity-70"/><span className="flex-1 bg-secondary" style={{ height: `${String(point.views === 0 ? 0 : point.uniqueReaders / point.views * 100)}%` }}/></div>)}</div>}</article>
}

function RankPanel({ title, rows, total }: { title: string; rows: readonly RankedMetric[]; total: number }): React.ReactElement {
  return <article className="border-b border-on-surface bg-surface-container-lowest p-6 shadow-[7px_8px_0_rgba(16,75,42,.12)]"><h3 className="font-display text-xl font-semibold">{title}</h3><div className="mt-6"><MiniBars rows={rows} total={total} empty={`No ${title.toLowerCase()} data in this period.`} /></div></article>
}

function MiniBars({ rows, total, empty }: { rows: readonly RankedMetric[]; total?: number; empty: string }): React.ReactElement {
  const max = Math.max(1, ...rows.map((row) => row.value))
  if (rows.length === 0) return <p className="border border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">{empty}</p>
  return <ol className="space-y-4">{rows.map((row) => <li key={row.label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate">{row.label}</span><strong className="font-mono tabular-nums">{row.value}{total === undefined ? '' : ` · ${percent(row.value, total)}`}</strong></div><div className="h-2 bg-surface-container-high"><span className="block h-full bg-primary" style={{ width: `${String(row.value / max * 100)}%` }}/></div></li>)}</ol>
}
