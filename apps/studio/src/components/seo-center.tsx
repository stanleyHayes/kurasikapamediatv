import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { SEOIssueView, SEOReportView, SEOLocaleView } from '@kurasikapa/web-kit/bff/seo'
import { StudioEmptyState } from './empty-state'

type Filter = 'all' | 'critical' | 'warning'
type Language = 'all' | 'en' | 'fr'

export function SEOCenter({ report, severity, language }: { report: SEOReportView; severity: Filter; language: Language }): React.ReactElement {
  const issues = report.issues.filter((issue) => (severity === 'all' || issue.severity === severity) && (language === 'all' || issue.locale === language))
  if (report.totalPublished === 0) return <StudioEmptyState icon="search" eyebrow="Search readiness" title="Publish the first original report" description="The SEO Center will audit every live story for approved copy, credited photography and a credible author profile as soon as newsroom reporting is published." action={{ href: '/articles/new', label: 'Create the first story' }} />
  return <div className="space-y-10">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b-4 border-on-surface pb-6"><div><p className="broadcast-kicker text-primary">Search readiness</p><h2 className="mt-2 font-display text-4xl font-semibold md:text-5xl">SEO Center</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">A live audit of published inventory. It checks what Google and readers can verify—approved copy, crawlable imagery and attributable journalism—without inventing rankings before Search Console is connected.</p></div><div className="border-l-4 border-secondary bg-surface-container-lowest px-5 py-4"><span className="block text-xs font-bold uppercase tracking-[.14em] text-on-surface-variant">Last audited</span><time className="mt-1 block font-mono text-sm">{formatInstant(report.generatedAt)}</time></div></header>
    <Kpis report={report}/>
    <section className="grid gap-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)]"><ReadinessChart report={report}/><PublishingInfrastructure/></section>
    <IssueQueue issues={issues} severity={severity} language={language} total={report.issues.length}/>
  </div>
}

function Kpis({ report }: { report: SEOReportView }): React.ReactElement {
  const metrics = [
    { label: 'Readiness score', value: `${String(report.readinessPercent)}%`, detail: `${String(report.readyArticles)} stories pass every check`, tone: 'bg-primary text-on-primary' },
    { label: 'Published stories', value: report.totalPublished.toLocaleString(), detail: 'English and French inventory', tone: 'bg-surface-container-lowest' },
    { label: 'Critical', value: report.criticalArticles.toLocaleString(), detail: 'Blocks credible search presentation', tone: 'bg-error-container text-on-error-container' },
    { label: 'Needs attention', value: report.warningArticles.toLocaleString(), detail: 'Editorial quality improvements', tone: 'bg-secondary-container' },
  ]
  return <section aria-label="SEO readiness KPIs" className="depth-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className={`min-h-40 border-b-2 border-on-surface p-6 shadow-[7px_8px_0_rgba(16,75,42,.13)] ${metric.tone}`}><p className="text-xs font-bold uppercase tracking-[.15em] opacity-70">{metric.label}</p><strong className="mt-5 block font-display text-4xl tabular-nums">{metric.value}</strong><p className="mt-2 text-xs opacity-75">{metric.detail}</p></article>)}</section>
}

function ReadinessChart({ report }: { report: SEOReportView }): React.ReactElement {
  return <section className="border-y-2 border-on-surface bg-surface-container-lowest p-6 shadow-[8px_9px_0_rgba(16,75,42,.12)]"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="broadcast-kicker text-primary">Inventory health</p><h3 className="mt-2 font-display text-3xl font-semibold">Readiness by language</h3></div><ScoreRing score={report.readinessPercent}/></div><div className="mt-8 space-y-7">{report.locales.map((item) => <LocaleBar key={item.locale} item={item}/>)}</div><div className="mt-8 flex flex-wrap gap-5 border-t border-outline-variant pt-5 text-xs font-bold uppercase tracking-[.1em]"><Legend tone="bg-primary" label="Ready"/><Legend tone="bg-secondary" label="Warning"/><Legend tone="bg-error" label="Critical"/></div></section>
}

function ScoreRing({ score }: { score: number }): React.ReactElement {
  return <div className="relative grid size-28 place-items-center rounded-full" role="img" aria-label={`${String(score)} percent of published stories are search ready`} style={{ background: `conic-gradient(var(--color-primary) ${String(score)}%, var(--color-surface-container-high) 0)` }}><span className="grid size-20 place-items-center rounded-full bg-surface-container-lowest font-display text-2xl font-bold">{score}%</span></div>
}

function LocaleBar({ item }: { item: SEOLocaleView }): React.ReactElement {
  const width = (value: number): string => item.published === 0 ? '0%' : `${String(value / item.published * 100)}%`
  return <div><div className="mb-3 flex items-end justify-between gap-4"><div><strong className="font-display text-xl">{item.locale === 'fr' ? 'French newsroom' : 'English newsroom'}</strong><p className="text-xs text-on-surface-variant">{item.published} published · {item.readinessPercent}% ready</p></div><span className="font-mono text-sm">{item.ready}/{item.published}</span></div><div className="flex h-5 overflow-hidden border border-outline" role="img" aria-label={`${item.locale}: ${String(item.ready)} ready, ${String(item.warning)} warning, ${String(item.critical)} critical`}><span className="bg-primary" style={{ width: width(item.ready) }}/><span className="bg-secondary" style={{ width: width(item.warning) }}/><span className="bg-error" style={{ width: width(item.critical) }}/></div></div>
}

function PublishingInfrastructure(): React.ReactElement {
  const systems = [
    ['News sitemap', 'Two-day fresh-story feed', '/news-sitemap.xml'],
    ['Article schema', 'NewsArticle, byline and dates', '/en/latest'],
    ['Social previews', 'Dynamic 1200 × 630 fallback', '/og-image'],
    ['Crawler controls', 'Robots and canonical sitemap', '/robots.txt'],
  ] as const
  return <section className="signal-grid border-y-2 border-on-surface bg-inverse-surface p-6 text-white shadow-[8px_9px_0_rgba(227,154,10,.22)]"><p className="broadcast-kicker text-secondary">Publishing infrastructure</p><h3 className="mt-2 font-display text-3xl font-semibold">Search delivery</h3><p className="mt-3 text-sm leading-6 text-white/65">Implemented surfaces are inspectable now. Search Console ownership and indexing alerts remain a launch-owner task.</p><div className="mt-7 space-y-3">{systems.map(([title, detail, href]) => <a key={title} href={href} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-4 border border-white/20 bg-white/5 p-4 hover:border-secondary"><span><strong className="block">{title}</strong><small className="mt-1 block text-white/60">{detail}</small></span><span className="text-secondary transition-transform group-hover:translate-x-1" aria-hidden>↗</span></a>)}</div></section>
}

function IssueQueue({ issues, severity, language, total }: { issues: readonly SEOIssueView[]; severity: Filter; language: Language; total: number }): React.ReactElement {
  return <section aria-labelledby="seo-issues"><div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-on-surface pb-5"><div><p className="broadcast-kicker text-primary">Action queue</p><h3 id="seo-issues" className="mt-2 font-display text-3xl font-semibold">Published-story findings</h3><p className="mt-2 text-sm text-on-surface-variant">{issues.length} shown from {total} open findings</p></div><div className="flex flex-wrap gap-2"><Filters name="severity" active={severity} values={['all', 'critical', 'warning']} language={language}/><Filters name="language" active={language} values={['all', 'en', 'fr']} severity={severity}/></div></div>{issues.length === 0 ? <div className="signal-grid mt-6 border border-outline-variant p-10 text-center"><span aria-hidden className="mx-auto grid size-14 animate-pulse place-items-center bg-primary text-2xl text-on-primary">✓</span><h4 className="mt-4 font-display text-2xl font-semibold">No findings in this view</h4><p className="mt-2 text-sm text-on-surface-variant">Change the filters, or keep publishing with complete bylines and media.</p></div> : <div className="mt-6 space-y-3">{issues.map((issue, index) => <IssueRow key={`${issue.articleId}-${issue.code}-${String(index)}`} issue={issue}/>)}</div>}</section>
}
function Filters({ name, active, values, severity = 'all', language = 'all' }: { name: 'severity' | 'language'; active: string; values: readonly string[]; severity?: Filter; language?: Language }): React.ReactElement {
  return <nav aria-label={`${name} filter`} className="flex border border-outline">{values.map((value) => { const query = name === 'severity' ? `severity=${value}&language=${language}` : `severity=${severity}&language=${value}`; return <Link key={value} href={`/seo?${query}`} aria-current={active === value ? 'page' : undefined} className={`px-3 py-2 text-[10px] font-bold uppercase ${active === value ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest'}`}>{value}</Link> })}</nav>
}

function IssueRow({ issue }: { issue: SEOIssueView }): React.ReactElement {
  return <article className="grid gap-4 border border-outline-variant bg-surface-container-lowest p-5 shadow-[5px_6px_0_rgba(16,75,42,.09)] md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-center"><div><span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase ${issue.severity === 'critical' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container'}`}>{issue.severity}</span><span className="mt-2 block font-mono text-[10px] uppercase text-on-surface-variant">{issue.locale} · {issue.code.replaceAll('_', ' ')}</span></div><div><h4 className="font-display text-xl font-semibold">{issue.title || 'Untitled story'}</h4><p className="mt-1 text-sm text-on-surface-variant">{issue.message}</p><p className="mt-2 text-xs font-semibold text-primary">Next: {issue.recommendation}</p></div><Link href={`/articles/${issue.articleId}`} className="border border-primary px-4 py-3 text-center text-xs font-bold uppercase text-primary hover:bg-primary hover:text-on-primary">Open story</Link></article>
}

function Legend({ tone, label }: { tone: string; label: string }): React.ReactElement { return <span className="inline-flex items-center gap-2"><i className={`size-3 ${tone}`}/>{label}</span> }
function formatInstant(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Just now' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) }
